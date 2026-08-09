/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * تقرير متابعة التحصيلات للحجوزات — Reservation Collection Follow-up Report
 *
 * Grouped BY CUSTOMER for the CURRENT YEAR (subsidiary 2):
 *   قيمة الحجز  = SUM of the customer's reservation totals  (CuTrSale101, cycle 1,
 *                 status A + B, trandate this year)
 *   المدفوع     = SUM of the customer's Customer Payments   (CustPymt, this year)
 *   رصيد العميل = SUM of postings on the deposit account 823 (all-time balance)
 *   الحالة      = مكتمل when المدفوع >= قيمة الحجز, غير مدفوع when المدفوع <= 0,
 *                 otherwise مدفوع جزئياً
 *
 * Query params: status | location | reportdate | export=pdf|xlsx | debug=T
 */
define(['N/query', 'N/log', 'N/render', 'N/file', 'N/runtime', 'N/search', 'N/https'], function (query, log, render, file, runtime, search, https) {

    // --- Constants ---------------------------------------------------------
    var SUBSIDIARY_ID = 2;
    var DEPOSIT_ACCOUNT = '823';
    var TITLE = 'تقرير متابعة التحصيلات للحجوزات';

    // Roles permitted to see all buildings
    var ALL_BUILDINGS_ROLES = ['3', '1068', '1043', '1005'];
    // Receptionist role(s)
    var RECEPTIONIST_ROLES = ['1019', '1075'];
    // Front-desk locations mapping to paired buildings
    var EMPLOYEE_LOCATION_TO_BUILDINGS = {
        '85': ['105', '108'],
        '86': ['104', '106']
    };

    var STATUS = {
        COMPLETE: { key: 'COMPLETE', label: 'مكتمل', cls: 'row-green', bg: '#c6efce' },
        UNPAID: { key: 'UNPAID', label: 'غير مدفوع', cls: 'row-yellow', bg: '#ffeb9c' },
        PARTIAL: { key: 'PARTIAL', label: 'مدفوع جزئياً', cls: 'row-orange', bg: '#ffcc99' }
    };

    // Column metadata shared by the HTML, Excel and PDF renderers.
    var COLUMNS = [
        { label: 'تاريخ انشاء الحجز', type: 'date' },
        { label: 'رقم الحجز', type: 'text' },
        { label: 'اسم العميل على نت سويت', type: 'text' },
        { label: 'رقم هاتف العميل', type: 'text' },
        { label: 'الموقع', type: 'text' },
        { label: 'السمسار', type: 'text' },
        { label: 'تاريخ بداية الحجز', type: 'text' },
        { label: 'تاريخ نهاية الحجز', type: 'text' },
        { label: 'قيمة الحجز', type: 'num' },
        { label: 'المدفوع', type: 'num' },
        { label: 'المتبقي', type: 'num' },
        { label: 'حالة الحجز', type: 'text' },
        { label: 'تاريخ الاشعار الى موظف الاستقبال', type: 'text' },
        { label: 'ملاحظات', type: 'text' },
        { label: 'تفاصيل روابط الدفع', type: 'html' }
    ];

    // Current-year date bounds [start, next) for trandate filtering.
    function yearBounds() {
        var y = new Date().getFullYear();
        return { year: y, start: y + '-01-01', next: (y + 1) + '-01-01' };
    }

    function dateFilter(alias) {
        var b = yearBounds();
        return ' AND ' + alias + '.trandate >= TO_DATE(\'' + b.start + '\', \'YYYY-MM-DD\')' +
            ' AND ' + alias + '.trandate < TO_DATE(\'' + b.next + '\', \'YYYY-MM-DD\')';
    }

    /**
     * Resolves allowed building IDs for the logged-in user.
     * Returns null if user can see all buildings (Roles: 3, 1068, 1043, 1005).
     * Returns an array of building location ID strings if restricted (e.g. Receptionist Role 1019).
     */
    function getAllowedBuildings() {
        var user = runtime.getCurrentUser();
        var userRole = String(user.role || '');
        var roleId = String(user.roleId || '').toLowerCase();

        // Roles exempt from restrictions: can see all buildings
        if (ALL_BUILDINGS_ROLES.indexOf(userRole) !== -1 || userRole === '3' || roleId === 'administrator') {
            return null;
        }

        // Determine employee location
        var empLocation = user.location ? String(user.location) : '';
        if (!empLocation && user.id) {
            try {
                var empLookup = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: user.id,
                    columns: ['location']
                });
                if (empLookup && empLookup.location && empLookup.location.length > 0) {
                    empLocation = String(empLookup.location[0].value);
                }
            } catch (e) {
                log.error('Lookup employee location error', e);
            }
        }

        if (empLocation) {
            var mapped = EMPLOYEE_LOCATION_TO_BUILDINGS[empLocation];
            var allowed = (mapped && mapped.length > 0) ? mapped.map(String) : [String(empLocation)];
            log.audit('Receptionist restriction applied', 'User ' + user.id + ' (Role ' + userRole + ', Emp Loc ' + empLocation + ') restricted to: ' + allowed.join(', '));
            return allowed;
        }

        log.error('No employee location found', 'User ' + user.id + ' (Role ' + userRole + ') has no employee location set.');
        return null;
    }

    // ---------------------------------------------------------------------
    // Reservations (this year): one row per reservation; aggregated per customer
    // in JS. Queried directly (no contract link needed now that paid comes from
    // payments). Status uses the prefixed enum form per this account's SuiteQL.
    function getReservationSql(allowedBuildingIds) {
        var sql = [
            'SELECT',
            '  t."ID" AS reservation_id,',
            '  t.tranid AS tranid,',
            '  t.trandate AS reservation_date,',
            '  t.startdate AS startdate,',
            '  t.enddate AS enddate,',
            '  t.entity AS entity_id,',
            '  BUILTIN.DF(t.entity) AS entity_name,',
            '  c.phone AS customer_phone,',
            '  tl.location AS location_id,',
            '  BUILTIN.DF(tl.location) AS location_name,',
            '  BUILTIN.DF(t.custbody_ns_sales_person) AS sales_person_name,',
            '  t.foreigntotal AS foreigntotal',
            'FROM "TRANSACTION" t, transactionLine tl, customer c',
            'WHERE t."ID" = tl."TRANSACTION"',
            '  AND tl.mainline = \'T\'',
            '  AND t.entity = c."ID"(+)',
            '  AND t."TYPE" IN (\'CuTrSale101\')',
            '  AND t.status IN (\'CuTrSale101:A\', \'CuTrSale101:B\')',
            '  AND t.custbody_ns_reservation_cycle IN (\'1\')',
            '  AND tl.subsidiary IN (' + SUBSIDIARY_ID + ')' + dateFilter('t')
        ];

        if (allowedBuildingIds && allowedBuildingIds.length > 0) {
            var locIn = allowedBuildingIds.map(function (id) {
                return '\'' + String(id).replace(/'/g, "''") + '\'';
            }).join(', ');
            sql.push('  AND tl.location IN (' + locIn + ')');
        }

        return sql.join('\n');
    }

    // Customer Payments (this year) summed per customer.
    function getPaymentsSql() {
        return [
            'SELECT t.entity AS entity, SUM(t.foreigntotal) AS paid',
            'FROM "TRANSACTION" t, transactionLine tl',
            'WHERE t."ID" = tl."TRANSACTION"',
            '  AND tl.mainline = \'T\'',
            '  AND t."TYPE" IN (\'CustPymt\')',
            '  AND t.entity IS NOT NULL',
            '  AND tl.subsidiary IN (' + SUBSIDIARY_ID + ')' + dateFilter('t'),
            'GROUP BY t.entity'
        ].join('\n');
    }

    // Fetch payment links from the Nassayem website API
    function fetchPaymentLinks() {
        var url = "https://www.nassayem.com/api/netsuite-payments/sync";
        var secret = "nidhalghdiri98590405";
        var mapByRef = {};
        try {
            var response = https.get({
                url: url,
                headers: {
                    "Authorization": "Bearer " + secret
                }
            });
            if (response.code === 200) {
                var list = JSON.parse(response.body);
                list.forEach(function(p) {
                    var ref = p.netsuiteReservationRef;
                    if (ref) {
                        if (!mapByRef[ref]) mapByRef[ref] = [];
                        mapByRef[ref].push(p);
                    }
                });
            } else {
                log.error('fetchPaymentLinks error', response.code + ': ' + response.body);
            }
        } catch (e) {
            log.error('fetchPaymentLinks exception', e);
        }
        return mapByRef; 
    }

    // Customer deposit-account (823) balance, all-time, per customer.
    function getBalanceSql() {
        return [
            'SELECT transactionLine.entity AS entity, SUM(TransactionAccountingLine.amount) AS balance',
            'FROM "TRANSACTION", TransactionAccountingLine, transactionLine',
            'WHERE transactionLine."TRANSACTION" = TransactionAccountingLine."TRANSACTION"',
            '  AND transactionLine."ID" = TransactionAccountingLine.transactionline',
            '  AND "TRANSACTION"."ID" = transactionLine."TRANSACTION"',
            '  AND "TRANSACTION".posting = \'T\'',
            '  AND TransactionAccountingLine."ACCOUNT" IN (\'' + DEPOSIT_ACCOUNT + '\')',
            '  AND transactionLine.subsidiary IN (' + SUBSIDIARY_ID + ')',
            '  AND transactionLine.entity IS NOT NULL',
            'GROUP BY transactionLine.entity'
        ].join('\n');
    }

    // --- fetch + aggregate -------------------------------------------------
    function sumByEntity(sql) {
        var map = {};
        query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (r) {
            map[r.entity] = toNum(r.paid != null ? r.paid : r.balance);
        });
        return map;
    }

    // Aggregate reservation rows into one record per customer.
    function fetchCustomers(allowedBuildingIds) {
        var rows = query.runSuiteQL({ query: getReservationSql(allowedBuildingIds) }).asMappedResults();
        var map = {};
        rows.forEach(function (r) {
            var key = r.entity_id;
            if (key == null) { return; }
            var when = r.startdate || r.reservation_date;
            var dk = dateSortKey(when);
            if (!map[key]) {
                map[key] = {
                    entityId: r.entity_id,
                    entityName: r.entity_name,
                    phone: r.customer_phone,
                    locationId: r.location_id,
                    locationName: r.location_name,
                    salesPerson: r.sales_person_name,
                    reservationDate: when,
                    tranids: [],
                    startdates: [],
                    enddates: [],
                    reservationTotal: 0,
                    paid: 0,
                    balance: 0,
                    _latest: dk
                };
            }
            var g = map[key];
            g.reservationTotal += toNum(r.foreigntotal);
            if (!g.phone && r.customer_phone) { g.phone = r.customer_phone; }
            if (r.tranid && g.tranids.indexOf(r.tranid) === -1) g.tranids.push(r.tranid);
            if (r.startdate && g.startdates.indexOf(r.startdate) === -1) g.startdates.push(r.startdate);
            if (r.enddate && g.enddates.indexOf(r.enddate) === -1) g.enddates.push(r.enddate);
            // Keep the most-recent reservation's date/location/sales person.
            if (dk >= g._latest) {
                g._latest = dk;
                g.reservationDate = when;
                if (r.location_name) { g.locationId = r.location_id; g.locationName = r.location_name; }
                if (r.sales_person_name) { g.salesPerson = r.sales_person_name; }
            }
        });
        return map;
    }

    function resolveStatus(g) {
        if (g.reservationTotal > 0 && g.paid >= g.reservationTotal) { return STATUS.COMPLETE; }
        if (g.paid <= 0) { return STATUS.UNPAID; }
        return STATUS.PARTIAL;
    }

    function toNum(v) {
        var n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }

    // المتبقي = قيمة الحجز - المدفوع
    function remaining(g) {
        return toNum(g.reservationTotal) - toNum(g.paid);
    }

    // Build the report dataset + filter option lists from the request params.
    function buildData(params) {
        var allowedBuildingIds = getAllowedBuildings();
        var statusFilter = params.status || '';
        var locationFilter = params.location || '';
        var reportDate = params.reportdate || todayDisplay();

        // If restricted, ensure locationFilter doesn't try to access unauthorized building
        if (allowedBuildingIds && allowedBuildingIds.length > 0) {
            if (locationFilter && allowedBuildingIds.indexOf(String(locationFilter)) === -1) {
                locationFilter = '';
            }
        }

        var custMap = fetchCustomers(allowedBuildingIds);
        var payments = sumByEntity(getPaymentsSql());   // { entity: paid }
        var balances = sumByEntity(getBalanceSql());    // { entity: balance }
        var paymentLinksMap = fetchPaymentLinks();      // { ref: [links] }

        var allGroups = Object.keys(custMap).map(function (k) {
            var g = custMap[k];
            g.paid = payments[g.entityId] != null ? payments[g.entityId] : 0;
            g.balance = balances[g.entityId] != null ? balances[g.entityId] : 0;
            g.status = resolveStatus(g);

            var links = [];
            if (g.tranids && g.tranids.length > 0) {
                g.tranids.forEach(function(ref) {
                    if (paymentLinksMap[ref]) {
                        links = links.concat(paymentLinksMap[ref]);
                    }
                });
            }
            g.paymentLinks = links;

            return g;
        });

        // Distinct locations for the filter dropdown.
        var locMap = {};
        allGroups.forEach(function (g) {
            if (g.locationId) {
                if (!allowedBuildingIds || allowedBuildingIds.indexOf(String(g.locationId)) !== -1) {
                    locMap[g.locationId] = g.locationName || g.locationId;
                }
            }
        });
        var locations = Object.keys(locMap).map(function (id) {
            return { id: id, name: locMap[id] };
        }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

        var groups = allGroups;
        if (statusFilter) {
            groups = groups.filter(function (g) { return g.status.key === statusFilter; });
        }
        if (locationFilter) {
            groups = groups.filter(function (g) { return String(g.locationId) === String(locationFilter); });
        }

        // Most-recent reservation first.
        groups.sort(function (a, b) { return (b._latest || 0) - (a._latest || 0); });

        return {
            groups: groups,
            locations: locations,
            statusFilter: statusFilter,
            locationFilter: locationFilter,
            reportDate: reportDate,
            scriptId: params.script,
            deployId: params.deploy,
            allowedBuildingIds: allowedBuildingIds
        };
    }

    // One customer -> array of cell descriptors aligned with COLUMNS.
    function rowCells(g) {
        var paymentLinksHtml = '';
        if (g.paymentLinks && g.paymentLinks.length > 0) {
            paymentLinksHtml = g.paymentLinks.map(function(pl) {
                var url = "https://www.nassayem.com/ar/pay/" + pl.token;
                var color = pl.status === 'PAID' ? 'green' : (pl.status === 'FAILED' || pl.status === 'VOIDED' ? 'red' : '#e68a00');
                var errStr = pl.netsuiteSyncError ? ('<br><span style="color:red;font-size:10px;">خطأ: ' + esc(pl.netsuiteSyncError) + '</span>') : '';
                return '<div style="margin-bottom:4px;border-bottom:1px solid #ccc;padding-bottom:2px;"><a href="' + url + '" target="_blank" style="color:#0055cc;text-decoration:none;">' + esc(pl.netsuiteReservationRef) + '</a> - <strong style="color:' + color + ';">' + esc(pl.status) + '</strong> (' + pl.amount + ' ' + pl.currency + ')' + errStr + '</div>';
            }).join('');
        }

        return [
            { type: 'date', display: fmtDate(g.reservationDate), sort: dateSortKey(g.reservationDate) },
            { type: 'text', display: (g.tranids || []).join(', ') },
            { type: 'text', display: g.entityName || '' },
            { type: 'text', display: g.phone || '' },
            { type: 'text', display: g.locationName || '' },
            { type: 'text', display: g.salesPerson || '' },
            { type: 'text', display: (g.startdates || []).map(fmtDate).join(', ') },
            { type: 'text', display: (g.enddates || []).map(fmtDate).join(', ') },
            { type: 'num', display: fmtMoney(g.reservationTotal), sort: g.reservationTotal },
            { type: 'num', display: fmtMoney(g.paid), sort: g.paid },
            { type: 'num', display: fmtMoney(remaining(g)), sort: remaining(g) },
            { type: 'text', display: g.status.label },
            { type: 'text', display: '' },   // تاريخ الاشعار (يدوي)
            { type: 'text', display: '' },    // ملاحظات (يدوي)
            { type: 'html', display: paymentLinksHtml, textDisplay: formatLinksText(g.paymentLinks) }
        ];
    }

    // Column totals (one row per customer, so no de-duplication needed).
    function computeTotals(groups) {
        var t = { count: groups.length, reservationTotal: 0, paid: 0, remaining: 0 };
        groups.forEach(function (g) {
            t.reservationTotal += toNum(g.reservationTotal);
            t.paid += toNum(g.paid);
            t.remaining += remaining(g);
        });
        return t;
    }

    // -----------------------------------------------------------------------
    function onRequest(context) {
        var params = context.request.parameters || {};

        if (params.debug === 'T' || params.debug === 't') {
            context.response.write(renderDebug());
            return;
        }

        try {
            var data = buildData(params);
            log.audit('Reservation Collection Report', 'customers: ' + data.groups.length);

            if (params.export === 'xlsx') { return writeExcel(context, data); }
            if (params.export === 'pdf') { return writePdf(context, data); }

            context.response.write(renderHtml(data));
        } catch (e) {
            log.error('Reservation Collection Report - error', e);
            context.response.write(
                '<html dir="rtl"><body style="font-family:monospace;direction:ltr">' +
                '<h2>Suitelet error</h2><pre>' +
                esc((e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : e) +
                    '\n\n' + (e && e.stack ? e.stack : '')) +
                '</pre></body></html>'
            );
        }
    }

    // ===================== HTML report =====================================
    function renderHtml(data) {
        var groups = data.groups;

        var bodyRows = groups.map(function (g) {
            var tds = rowCells(g).map(function (c) {
                if (c.type === 'num') {
                    return '<td class="num" data-sort="' + esc(c.sort) + '">' + esc(c.display) + '</td>';
                }
                if (c.type === 'date') {
                    return '<td data-sort="' + esc(c.sort) + '">' + esc(c.display) + '</td>';
                }
                if (c.type === 'html') {
                    return '<td style="text-align:right;white-space:normal;font-size:11px;">' + c.display + '</td>';
                }
                return '<td>' + esc(c.display) + '</td>';
            }).join('');
            return '<tr class="' + g.status.cls + '">' + tds + '</tr>';
        }).join('\n');

        if (!groups.length) {
            bodyRows = '<tr class="empty-row"><td colspan="' + COLUMNS.length + '" class="empty">لا توجد بيانات مطابقة</td></tr>';
        }

        var headCells = COLUMNS.map(function (c, i) {
            return '<th data-type="' + c.type + '" onclick="rcSort(' + i + ',\'' + c.type + '\',this)">' +
                esc(c.label) + '<span class="arr"></span></th>';
        }).join('');

        return [
            '<!DOCTYPE html>',
            '<html dir="rtl" lang="ar">',
            '<head>',
            '<meta charset="utf-8"/>',
            '<title>' + esc(TITLE) + '</title>',
            '<style>',
            ' body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;direction:rtl;margin:16px;color:#222;}',
            ' h1{text-align:center;font-size:20px;margin:8px 0 4px;}',
            ' .sub{text-align:center;color:#666;font-size:12px;margin-bottom:14px;}',
            ' .filters{display:flex;gap:16px;justify-content:flex-start;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;}',
            ' .filters label{display:block;font-size:12px;margin-bottom:4px;color:#555;}',
            ' .filters select,.filters input{padding:5px 8px;font-size:13px;}',
            ' .filters button{padding:6px 16px;font-size:13px;cursor:pointer;}',
            ' .btn-export{color:#fff;border:none;border-radius:3px;}',
            ' .btn-export.excel{background:#1d6f42;}',
            ' .btn-export.pdf{background:#b3261e;}',
            ' table{border-collapse:collapse;width:100%;font-size:12px;}',
            ' th,td{border:1px solid #999;padding:6px 8px;text-align:center;white-space:nowrap;}',
            ' th{background:#f0f0f0;font-weight:600;cursor:pointer;user-select:none;}',
            ' th:hover{background:#e2e2e2;}',
            ' th .arr{font-size:10px;margin-inline-start:4px;color:#666;}',
            ' .row-green{background:#c6efce;}',
            ' .row-yellow{background:#ffeb9c;}',
            ' .row-orange{background:#ffcc99;}',
            ' .empty{padding:20px;color:#888;}',
            ' .num{font-variant-numeric:tabular-nums;}',
            ' tfoot .totals-row{background:#e8e8e8;font-weight:700;}',
            ' tfoot td{border:1px solid #999;padding:6px 8px;text-align:center;}',
            ' @media print{.filters{display:none;}}',
            '</style>',
            '</head>',
            '<body>',
            ' <h1>' + esc(TITLE) + '</h1>',
            ' <div class="sub">حسب العميل — سنة ' + yearBounds().year + '</div>',
            ' <form method="get" class="filters">',
            '   <input type="hidden" name="script" value="' + esc(data.scriptId) + '"/>',
            '   <input type="hidden" name="deploy" value="' + esc(data.deployId) + '"/>',
            '   <div>',
            '     <label>فلتر الحالة</label>',
            '     <select name="status" onchange="this.form.submit()">',
            '       <option value="">الكل</option>',
            statusOption('COMPLETE', 'مكتمل', data.statusFilter),
            statusOption('UNPAID', 'غير مدفوع', data.statusFilter),
            statusOption('PARTIAL', 'مدفوع جزئياً', data.statusFilter),
            '     </select>',
            '   </div>',
            '   <div>',
            '     <label>فلتر الموقع</label>',
            '     <select name="location" onchange="this.form.submit()">',
            '       <option value="">الكل</option>',
            data.locations.map(function (l) {
                return '       <option value="' + esc(l.id) + '"' +
                    (String(data.locationFilter) === String(l.id) ? ' selected' : '') + '>' + esc(l.name) + '</option>';
            }).join('\n'),
            '     </select>',
            '   </div>',
            '   <div>',
            '     <label>تاريخ التقرير</label>',
            '     <input type="text" name="reportdate" value="' + esc(data.reportDate) + '" onchange="this.form.submit()"/>',
            '   </div>',
            '   <div><button type="submit" name="export" value="pdf" class="btn-export pdf">تصدير PDF</button></div>',
            '   <div><button type="submit" name="export" value="xlsx" class="btn-export excel">تصدير Excel</button></div>',
            ' </form>',
            ' <table id="rcTable">',
            '   <thead><tr>' + headCells + '</tr></thead>',
            '   <tbody>',
            bodyRows,
            '   </tbody>',
            renderTotalsFoot(groups),
            ' </table>',
            renderSortScript(),
            '</body>',
            '</html>'
        ].join('\n');
    }

    // Totals row (tfoot) — stays fixed; sorting only touches tbody.
    function renderTotalsFoot(groups) {
        if (!groups.length) { return ''; }
        var t = computeTotals(groups);
        return '<tfoot><tr class="totals-row">' +
            '<td colspan="8">الإجمالي (' + t.count + ' عميل)</td>' +
            '<td class="num">' + fmtMoney(t.reservationTotal) + '</td>' +
            '<td class="num">' + fmtMoney(t.paid) + '</td>' +
            '<td class="num">' + fmtMoney(t.remaining) + '</td>' +
            '<td colspan="4"></td>' +
            '</tr></tfoot>';
    }

    function renderSortScript() {
        return [
            '<script>',
            'function rcCellVal(td,type){',
            '  var s=td.getAttribute("data-sort");',
            '  if(s===null||s==="") s=(td.textContent||"").trim();',
            '  if(type==="num"||type==="date"){var n=parseFloat(s);return isNaN(n)?-Infinity:n;}',
            '  return (s||"").toString().toLowerCase();',
            '}',
            'function rcSort(idx,type,th){',
            '  var table=document.getElementById("rcTable");var tb=table.tBodies[0];',
            '  var rows=Array.prototype.slice.call(tb.rows).filter(function(r){return !r.className.match(/empty-row/);});',
            '  if(!rows.length) return;',
            '  var dir=th.getAttribute("data-dir")==="asc"?"desc":"asc";',
            '  var ths=table.tHead.rows[0].cells;',
            '  for(var i=0;i<ths.length;i++){ths[i].removeAttribute("data-dir");var a=ths[i].querySelector(".arr");if(a)a.textContent="";}',
            '  rows.sort(function(a,b){var x=rcCellVal(a.cells[idx],type),y=rcCellVal(b.cells[idx],type);',
            '    if(x<y)return dir==="asc"?-1:1;if(x>y)return dir==="asc"?1:-1;return 0;});',
            '  rows.forEach(function(r){tb.appendChild(r);});',
            '  th.setAttribute("data-dir",dir);',
            '  var arr=th.querySelector(".arr");if(arr)arr.textContent=dir==="asc"?" \\u25B2":" \\u25BC";',
            '}',
            '</script>'
        ].join('\n');
    }

    // ===================== Excel export ====================================
    function writeExcel(context, data) {
        var head = COLUMNS.map(function (c) {
            return '<th style="background:#f0f0f0;border:1px solid #999;padding:4px">' + esc(c.label) + '</th>';
        }).join('');

        var body = data.groups.map(function (g) {
            var tds = rowCells(g).map(function (c) {
                var align = c.type === 'num' ? 'right' : 'center';
                var val = (c.type === 'num') ? c.sort : (c.textDisplay != null ? c.textDisplay : c.display);
                return '<td style="border:1px solid #999;padding:4px;text-align:' + align + '">' + esc(val) + '</td>';
            }).join('');
            return '<tr style="background:' + g.status.bg + '">' + tds + '</tr>';
        }).join('');

        var t = computeTotals(data.groups);
        var totals = '<tr style="background:#e8e8e8;font-weight:bold">' +
            '<td colspan="8" style="border:1px solid #999;padding:4px">الإجمالي (' + t.count + ')</td>' +
            '<td style="border:1px solid #999;padding:4px;text-align:right">' + t.reservationTotal + '</td>' +
            '<td style="border:1px solid #999;padding:4px;text-align:right">' + t.paid + '</td>' +
            '<td style="border:1px solid #999;padding:4px;text-align:right">' + t.remaining + '</td>' +
            '<td colspan="4" style="border:1px solid #999;padding:4px"></td></tr>';

        var html =
            '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
            '<head><meta charset="utf-8"/></head><body>' +
            '<table border="1" dir="rtl"><thead><tr>' + head + '</tr></thead>' +
            '<tbody>' + body + '</tbody><tfoot>' + totals + '</tfoot></table>' +
            '</body></html>';

        var xls = file.create({ name: 'reservation_collection.xls', fileType: file.Type.EXCEL, contents: html });
        context.response.writeFile({ file: xls, isInline: false });
    }

    // ===================== PDF export (BFO) ================================
    function writePdf(context, data) {
        var head = COLUMNS.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('');

        var body = data.groups.map(function (g) {
            var tds = rowCells(g).map(function (c) {
                var align = c.type === 'num' ? 'right' : 'center';
                var val = c.textDisplay != null ? c.textDisplay : c.display;
                return '<td align="' + align + '">' + esc(val) + '</td>';
            }).join('');
            return '<tr style="background-color:' + g.status.bg + '">' + tds + '</tr>';
        }).join('');

        if (!data.groups.length) {
            body = '<tr><td colspan="' + COLUMNS.length + '" align="center">لا توجد بيانات مطابقة</td></tr>';
        } else {
            var t = computeTotals(data.groups);
            body += '<tr style="background-color:#e8e8e8;font-weight:bold">' +
                '<td colspan="8">الإجمالي (' + t.count + ')</td>' +
                '<td align="right">' + fmtMoney(t.reservationTotal) + '</td>' +
                '<td align="right">' + fmtMoney(t.paid) + '</td>' +
                '<td align="right">' + fmtMoney(t.remaining) + '</td>' +
                '<td colspan="4"></td></tr>';
        }

        var xml =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">' +
            '<pdf>' +
            '<head><style type="text/css">' +
            ' table{width:100%;border-collapse:collapse;font-size:7px;}' +
            ' th,td{border:0.5px solid #999;padding:3px;}' +
            ' th{background-color:#f0f0f0;font-weight:bold;}' +
            ' h1{text-align:center;font-size:12px;}' +
            '</style></head>' +
            '<body size="A4-LANDSCAPE" padding="0.4in 0.4in 0.4in 0.4in">' +
            '<h1>' + esc(TITLE) + ' — ' + yearBounds().year + '</h1>' +
            '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
            '</body></pdf>';

        var pdfFile = render.xmlToPdf({ xmlString: xml });
        context.response.writeFile({ file: pdfFile, isInline: true });
    }

    // ===================== diagnostics (?debug=T) =========================
    function renderDebug() {
        var user = runtime.getCurrentUser();
        var allowed = getAllowedBuildings();
        var checks = [
            { label: 'Logged-in User ID', value: user.id },
            { label: 'Logged-in Role', value: user.role + ' (' + (user.roleId || '') + ')' },
            { label: 'Employee Location', value: user.location || '(none on runtime)' },
            { label: 'Allowed Building IDs', value: allowed ? allowed.join(', ') : 'All Buildings (No restriction)' },
            { label: 'Reservations (rows) this year', sql: 'SELECT COUNT(*) AS c FROM (' + getReservationSql(allowed) + ')' },
            { label: 'Customer Payments (grouped)', sql: 'SELECT COUNT(*) AS c FROM (' + getPaymentsSql() + ')' },
            { label: 'Deposit balances (grouped)', sql: 'SELECT COUNT(*) AS c FROM (' + getBalanceSql() + ')' }
        ];
        var html = ['<html dir="ltr"><head><meta charset="utf-8"/>',
            '<style>body{font-family:monospace;margin:20px}table{border-collapse:collapse}',
            'td,th{border:1px solid #999;padding:6px 10px;text-align:left}pre{white-space:pre-wrap}</style></head><body>',
            '<h2>Reservation Collection Report — diagnostics (year ' + yearBounds().year + ')</h2>',
            '<table><tr><th>Check / Info</th><th>Value / Count</th></tr>'];
        checks.forEach(function (ch) {
            var count;
            if (ch.value !== undefined) {
                count = ch.value;
            } else {
                try {
                    var res = query.runSuiteQL({ query: ch.sql });
                    count = res.results.length ? res.results[0].values[0] : 0;
                } catch (e) { count = 'ERROR: ' + (e && e.message ? e.message : e); }
            }
            html.push('<tr><td>' + esc(ch.label) + '</td><td>' + esc(count) + '</td></tr>');
        });
        html.push('</table>');
        html.push('<h3>Reservation SQL</h3><pre>' + esc(getReservationSql(allowed)) + '</pre>');
        html.push('<h3>Payments SQL</h3><pre>' + esc(getPaymentsSql()) + '</pre>');
        html.push('</body></html>');
        return html.join('\n');
    }

    // --- helpers -----------------------------------------------------------
    function statusOption(val, label, sel) {
        return '       <option value="' + val + '"' + (sel === val ? ' selected' : '') + '>' + label + '</option>';
    }

    // Thousands separator, drops trailing .00.
    function fmtMoney(n) {
        var v = toNum(n);
        var neg = v < 0;
        v = Math.abs(Math.round(v * 100) / 100);
        var intPart = Math.floor(v);
        var cents = Math.round((v - intPart) * 100);
        var intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        var out = intStr + (cents ? '.' + (cents < 10 ? '0' + cents : cents) : '');
        return (neg ? '-' : '') + out;
    }

    function formatLinksText(links) {
        if (!links || links.length === 0) return '';
        return links.map(function(pl) {
            var url = "https://www.nassayem.com/ar/pay/" + pl.token;
            var errStr = pl.netsuiteSyncError ? ' (خطأ المزامنة)' : '';
            return pl.netsuiteReservationRef + ' - ' + pl.status + ' (' + pl.amount + ')' + errStr + ' | ' + url;
        }).join('\n');
    }

    function fmtDate(d) { return d ? String(d) : ''; }

    function dateSortKey(s) {
        if (!s) { return 0; }
        var m = String(s).match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
        if (!m) { return 0; }
        var y, mo, d;
        if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; }
        else { d = +m[1]; mo = +m[2]; y = +m[3]; }
        return y * 10000 + mo * 100 + d;
    }

    function todayDisplay() {
        var d = new Date();
        function p(x) { return (x < 10 ? '0' : '') + x; }
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { onRequest: onRequest };
});
