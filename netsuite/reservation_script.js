/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define([
    "N/log",
    "N/ui/dialog",
    "N/currentRecord",
    "N/record",
    "N/format",
    "N/url",
    "N/search",
    "N/runtime",
    "N/https",
    "./lib/dayjss.min",
], function (
    log,
    dialog,
    currentRecord,
    record,
    format,
    url,
    search,
    runtime,
    https,
    dayjs
) {
    var flag = "manual";


    var SUITELET_SCRIPT_ID = "customscript_ns_sl_payment_link";
    var SUITELET_DEPLOY_ID = "customdeploy_ns_sl_payment_link";
    var WEBSITE_BASE_URL = "https://www.nassayem.com";
    var INBOUND_SECRET = "nidhalghdiri98590405";

    // Field-id map for the reservation record. Replace with your actual ids.
    var FIELD_IDS = {
        reservationRef: "tranid",                       // human-readable id
        customerEntity: "entity",                       // standard customer link
        customerNameTxt: "custbody_ns_customer_name",    // free-text fallback
        customerPhone: "custbody_nass_customer_phone",
        customerEmail: "custbody_nass_customer_email",
        checkIn: "startdate",                            // reservation check-in (standard start date)
        checkOut: "enddate",                             // reservation check-out (standard end date)
        buildingId: "location",                          // building = NetSuite location field
        unitCode: "custbody_nass_unit_code",
        description: "memo",
    };

    function addPeriod(startDate, period) {
        var endDate = startDate;
        endDate.setDate(startDate.getDate() + period);

        return endDate;
    }
    function DateToString(date) {
        var dd = date.getDate();
        var mm = date.getMonth() + 1;
        var yyyy = date.getFullYear();
        newDate = dd + "/" + mm + "/" + yyyy;
        return newDate;
    }

    function toDateStamp(value) {
        // Returns "YYYY-MM-DD" using calendar components (no UTC conversion).
        // Why: .toISOString() shifts dates across the day boundary in non-UTC tz;
        // sending raw calendar parts lets the server reconstruct the same day.
        function pad2(n) { return n < 10 ? "0" + n : String(n); }
        if (value instanceof Date) {
            return value.getFullYear() + "-" + pad2(value.getMonth() + 1) + "-" + pad2(value.getDate());
        }
        if (typeof value === "string") {
            var m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) return m[3] + "-" + pad2(parseInt(m[2], 10)) + "-" + pad2(parseInt(m[1], 10));
        }
        return String(value);
    }

    function pageInit(context) {
        //   if (context.mode !== "create") return;
        var currentRecord = context.currentRecord;
        var a = dayjs().format("DD/MM/YYYY");
        console.log("Hello From Reservation");
        var userRole = runtime.getCurrentUser().role;
        console.log("User Role", userRole);
        if (context.mode !== "view" && userRole == "1019") {
            try {
                var buildingLocation = currentRecord.getValue({
                    fieldId: "location",
                });
                var currentStartDate = currentRecord.getValue({
                    fieldId: "startdate",
                });
                var currentEndDate = currentRecord.getValue({
                    fieldId: "enddate",
                });

                console.log("buildingLocation ", buildingLocation);
                console.log("currentStartDate ", currentStartDate);
                console.log("currentEndDate ", currentEndDate);
                var currentStartDateStr = DateToString(new Date(currentStartDate));
                var currentEndDateStr = DateToString(new Date(currentEndDate));

                console.log("currentStartDateStr ", currentStartDateStr);
                console.log("currentEndDateStr ", currentEndDateStr);

                var allUnits = searchAllUnits(buildingLocation);
                //     var unitsSearch = search.create({
                //       type: search.Type.ITEM,
                //       title: "Search All Units in Building",
                //       id: "customsearch_all_units_search",
                //       columns: [
                //         "internalid",
                //       ],
                //       filters: [[["location", "is", "208"]]],
                //     });
                //     var myResultSet = unitsSearch.run();

                // var resultRange = myResultSet.getRange({
                //     start: 0,
                //     end: 50
                // });

                // for (var i = 0; i < resultRange.length; i++) {
                //     console.log("unitsSearch ", resultRange[i]);
                // }

                console.log("allUnits ", allUnits);
                var occupiedUnits = searchOccuipedUnits(
                    buildingLocation,
                    currentStartDateStr,
                    currentEndDateStr
                );
                console.log("occupiedUnits ", occupiedUnits);
                if (allUnits.length > 0) {
                    var vacantUnits = allUnits.filter(function (value, index, arr) {
                        return !occupiedUnits.includes(value.id);
                    });
                    refreshUnitTypeFilterOptions(currentRecord, allUnits);
                    vacantUnits = applyTypeFilter(currentRecord, vacantUnits);
                    if (vacantUnits.length > 0) {
                        var numLines = currentRecord.getLineCount({
                            sublistId: "custpage_availbale_units",
                        });
                        // Remove All line from Availbale Units Sublist
                        if (numLines > 0) {
                            for (var i = numLines; i > 0; i--) {
                                currentRecord.removeLine({
                                    sublistId: "custpage_availbale_units",
                                    line: i - 1,
                                    ignoreRecalc: true,
                                });
                            }
                        }

                        for (var i = 0; i < vacantUnits.length; i++) {
                            currentRecord.selectNewLine("custpage_availbale_units");
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_id",
                                vacantUnits[i].id
                            );

                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_list",
                                vacantUnits[i].name
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_status",
                                vacantUnits[i].status
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_type",
                                vacantUnits[i].type
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_building",
                                vacantUnits[i].building
                            );
                            currentRecord.commitLine("custpage_availbale_units");
                        }
                    }
                }
                // Rank the freshly-loaded units and flag the best one to book.
                highlightRecommendedUnit(
                    currentRecord,
                    buildingLocation,
                    currentStartDate,
                    currentEndDate,
                    currentRecord.id
                );
            } catch (error) {
                console.log("ERROR => ", error);
            }
        }
    }

    // =========== Check If start Date & End Date in the same Month ========
    function sameMonths(start, end) {
        var startMonth = start.getMonth() + 1;
        var endMonth = end.getMonth() + 1;
        var startYear = start.getFullYear();
        var endYear = end.getFullYear();
        if (startMonth === endMonth && startYear === endYear) {
            return true;
        } else {
            return false;
        }
    }
    // =========== Get Days Number Until End Of the month ========
    function getDaysUntilEndOfMonth(d) {
        var lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        var oneDay = 1000 * 60 * 60 * 24;
        var diffInTime = lastDayOfMonth.getTime() - d.getTime();
        var daysUntilEndOfMonth = Math.round(diffInTime / oneDay);
        return daysUntilEndOfMonth;
    }
    // =========== Get Full Date End Of the month ========
    function getDateEndOfMonth(d) {
        var lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return lastDayOfMonth;
    }
    // =========== Get Next Start Date End in the month ========
    function getNextStartDateForNextMonth(d) {
        var nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return nextMonth;
    }
    function isLastDayOfMonth(date) {
        var nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        return nextDay.getMonth() !== date.getMonth();
    }
    // =========== Make Period for each month ========
    function dailyPeriods(start_date, end_date) {
        // Check if start_date is the last day of its month
        var isStartLastDay = isLastDayOfMonth(start_date);
        var monthsData = [];
        var i = 1;
        if (isStartLastDay) {
            // Create a 1-day contract for the last day of the month (31/07 to 01/08)
            var lastDayEnd = new Date(start_date);
            lastDayEnd.setDate(start_date.getDate() + 1); // Next day (01/08)

            monthsData.push({
                num: i,
                start: new Date(start_date),
                end: lastDayEnd,
                days: 1,
            });

            // Adjust the start_date to the next day (01/08)
            start_date = new Date(lastDayEnd);
            i++;
        }

        var endStatment = false;
        var oneDay = 1000 * 60 * 60 * 24;
        do {
            if (
                sameMonths(start_date, end_date) === false &&
                getDaysUntilEndOfMonth(start_date) > 0
            ) {
                var newEndDate = getDateEndOfMonth(start_date);

                // Calculate actual end date (next day after month end)
                var actualEndDate = new Date(newEndDate);
                actualEndDate.setDate(actualEndDate.getDate() + 1);

                var nextStartDate = getNextStartDateForNextMonth(start_date);

                // Compute days from the actual span so the first contract isn't short by 1
                var daysLeft = Math.round(
                    (actualEndDate.getTime() - start_date.getTime()) / oneDay
                );

                monthsData.push({
                    num: i,
                    start: start_date,
                    end: actualEndDate,
                    days: daysLeft,
                });
                start_date = nextStartDate;
                i += 1;
            } else {
                var lastDayOfMonth = end_date;
                var diffInTime = lastDayOfMonth.getTime() - start_date.getTime();
                var daysLeft = Math.round(diffInTime / oneDay);
                if (daysLeft > 0) {
                    monthsData.push({
                        num: i,
                        start: start_date,
                        end: end_date,
                        days: daysLeft,
                    });
                }
                endStatment = true;
            }
        } while (endStatment === false);
        return monthsData;
    }

    function monthlyPeriods(start_date, end_date) {
        var monthsData = [];
        var i = 1;
        var endStatment = false;
        do {
            if (
                sameMonths(start_date, end_date) === false &&
                30 - start_date.getDate() > 0
            ) {
                // var daysLeft = getDaysUntilEndOfMonth(start_date);
                var daysLeft = 30 - start_date.getDate();
                var newEndDate = getDateEndOfMonth(start_date);
                var nextStartDate = getNextStartDateForNextMonth(start_date);
                if (start_date.getDate() === 1) {
                    daysLeft = 30;
                }
                monthsData.push({
                    num: i,
                    start: start_date,
                    end: newEndDate,
                    days: daysLeft,
                });
                start_date = nextStartDate;
                i += 1;
            } else {
                var lastDayOfMonth = end_date;
                var oneDay = 1000 * 60 * 60 * 24;
                var diffInTime = lastDayOfMonth.getTime() - start_date.getTime();
                // var daysLeft = Math.round(diffInTime / oneDay);
                var daysLeft = end_date.getDate();
                // if (i > 1 && start_date.getDate() === 1) {
                //   daysLeft += 1;
                // }
                if (daysLeft > 0) {
                    if (daysLeft == getDateEndOfMonth(end_date).getDate()) {
                        daysLeft = 30;
                    }
                    monthsData.push({
                        num: i,
                        start: start_date,
                        end: end_date,
                        days: daysLeft,
                    });
                }
                endStatment = true;
            }
        } while (endStatment === false);
        return monthsData;
    }

    /* ==================================================
  
      Start Declare Functions with Day.js Library
  
     ==================================================*/

    // Get Differnce Months Func
    function getMonthDifference2(startDate, endDate) {
        // console.log("Month Diffrence = ", dayjs());
        // console.log(
        //   "Month Diffrence = ",
        //   dayjs(endDate).diff(dayjs(startDate), "month")
        // );
        return dayjs(endDate).diff(startDate, "month");
    }

    // Get Differnce Days Func
    function getDaysBetweenDates2(startDate, endDate) {
        // console.log("Days Between Dates = ", dayjs(endDate).diff(startDate, "day"));
        return dayjs(endDate).diff(startDate, "day");
    }

    // Check If Dates in same month
    function sameMonths2(startDate, endDate) {
        // console.log("Is The Same Month = ", startDate.isSame(endDate, "month"));
        return startDate.isSame(endDate, "month");
    }

    // Get Date end of the month
    function getDateEndOfMonth2(date) {
        // console.log("End Month Date = ", date.endOf("month"));
        return date.endOf("month");
    }

    // Get the diffrence days until the end of the month
    function getDaysUntilEndOfMonth2(date) {
        var endMonthDate = date.endOf("month");
        // console.log(
        //   "Days until the end of Month = ",
        //   endMonthDate.diff(date, "day")
        // );
        return endMonthDate.diff(date, "day");
    }

    // Get the  Start date for next month
    function getNextStartDateForNextMonth2(date) {
        var nextMonth = date.add(1, "month");
        // console.log("Start date for next month = ", nextMonth.startOf("month"));
        return nextMonth.startOf("month");
    }

    /* ==================================================
  
      End Declare Functions with Day.js Library
  
     ==================================================*/

    /* ==================================================
  
    Start Monthly Periods Function with Day.js Library
  
     ==================================================*/

    function monthlyPeriods2(start_date, end_date) {
        var monthsDiffr = getMonthDifference2(start_date, end_date);
        var daysDiffr = getDaysBetweenDates2(start_date, end_date);
        var start_new_contract = dayjs(start_date);
        if (monthsDiffr > 0) {
            var endStatment = false;
        } else {
            var endStatment = true;
        }

        // Initial Statement
        // console.log("==================  Initial Statement ==================");
        // console.log("Months Difference = ", monthsDiffr);
        // console.log("Days Difference = ", daysDiffr);
        // console.log("Start Date Initial Contract = ", start_new_contract);
        // console.log("Initial Statement = ", start_new_contract);
        // console.log("================== others Statement ==================");
        var contracts_data = [];
        var i = 1;
        do {
            if (monthsDiffr > 0) {
                var start_contract = start_new_contract;
                if (
                    start_contract.set("date", dayjs(start_date).date()).date() ===
                    dayjs(start_date).date()
                ) {
                    var end_contract = dayjs(start_contract).add(1, "month");
                } else {
                    var end_contract = start_contract
                        .add(1, "month")
                        .set("date", dayjs(start_date).date());
                }
                var days_contract = dayjs(end_contract).diff(
                    dayjs(start_contract),
                    "day"
                );
                contracts_data.push({
                    num: i,
                    start: dayjs(start_contract).format("DD/MM/YYYY"),
                    end: dayjs(end_contract).format("DD/MM/YYYY"),
                    days: 30,
                });
                i += 1;
                start_new_contract = end_contract;
                monthsDiffr -= 1;
            } else {
                // console.log("End Date Contract = ", start_new_contract);
                var rest_days_contract = dayjs(end_date).diff(
                    start_new_contract,
                    "day"
                );
                // console.log("Rest End Date Contract Diff = ", rest_days_contract);
                if (rest_days_contract > 1) {
                    contracts_data.push({
                        num: i,
                        start: dayjs(start_new_contract).format("DD/MM/YYYY"),
                        end: dayjs(end_date).format("DD/MM/YYYY"),
                        days: rest_days_contract,
                    });
                }
                endStatment = true;
            }
        } while (endStatment === false);

        // console.log("Contracts List : ", contracts_data);
        return contracts_data;
    }

    /* ==================================================
  
    End Monthly Periods Function with Day.js Library
  
     ==================================================*/

    // ====== OnClick Check In Button ====
    function onButtonClick(currentRecordId) {
        //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        //Load Reservation Transaction Record
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });

        //Get Reservation Transaction Status (Must Be Pending CheckIn)
        var reservationCycle = reservationRecord.getValue(
            "custbody_ns_reservation_cycle"
        );
        var reservationStatus = reservationRecord.getValue("transtatus");
        var reservationStartDate = reservationRecord.getValue("startdate");
        var reservationEndDate = reservationRecord.getValue("enddate");
        var reservationPostingPeriod = reservationRecord.getValue("postingperiod");
        var formatStartDate = format.parse({
            value: reservationStartDate,
            type: format.Type.DATE,
        });
        var formatEndDate = format.parse({
            value: reservationEndDate,
            type: format.Type.DATE,
        });
        var formatTodayDate = format.parse({
            value: new Date(),
            type: format.Type.DATE,
        });
        log.debug("Pending CheckIn", "Check In Date: " + formatStartDate);
        log.debug("Pending CheckIn", "Check Out Date: " + formatEndDate);
        log.debug("Pending CheckIn", "Today Date: " + formatTodayDate);
        var todayDateStr = DateToString(formatTodayDate);
        var startDateStr = DateToString(formatStartDate);
        var endDateStr = DateToString(formatEndDate);

        log.debug("CheckedIn", "Posting Period: " + reservationPostingPeriod);

        if (todayDateStr < startDateStr) {
            var options = {
                title: "تنويه",
                message: "تاريخ تسجيل الدخول يختلف عن تاريخ اليوم",
                buttons: [
                    { label: "إلغاء", value: 1 },
                    { label: "تسجيل الدخول", value: 2 },
                ],
            };
            function success(result) {
                if (result == 1) {
                    // console.log("إلغاء");
                } else if (result == 2) {
                    // console.log("تسجيل جروج");
                    checkIn(reservationId);
                }
            }
            function failure(reason) {
                console.log("Failure: " + reason);
            }
            dialog.create(options).then(success).catch(failure);
        } else if (todayDateStr > startDateStr) {
            var options = {
                title: "تنويه",
                message:
                    "تاريخ تسجيل الدخول " +
                    startDateStr +
                    " قبل تاريخ اليوم " +
                    todayDateStr,
                buttons: [
                    { label: "إلغاء", value: 1 },
                    { label: "تسجيل الدخول", value: 2 },
                ],
            };
            function success(result) {
                if (result == 1) {
                    // console.log("إلغاء");
                } else if (result == 2) {
                    // console.log("تسجيل جروج");
                    checkIn(reservationId);
                }
            }
            function failure(reason) {
                console.log("Failure: " + reason);
            }
            dialog.create(options).then(success).catch(failure);
        } else {
            checkIn(reservationId);
        }
    }
    // ====== OnClick Cancel Reservation Button ====
    function onCancelReservationClick(currentRecordId) {
        //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        //Load Reservation Transaction Record
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });

        //Get Reservation Transaction Status (Must Be Pending CheckIn)
        var reservationCycle = reservationRecord.getValue(
            "custbody_ns_reservation_cycle"
        );
        var reservationStatus = reservationRecord.getValue("transtatus");
        var reservationStartDate = reservationRecord.getValue("startdate");
        var reservationEndDate = reservationRecord.getValue("enddate");
        var reservationPostingPeriod = reservationRecord.getValue("postingperiod");
        // Update Reservation Status to "CheckIn"
        reservationRecord.setValue("transtatus", "C");

        try {
            // Save Reservation And Contract
            var newReservationId = reservationRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
            });
            log.debug("Resrvation Cancelled", "Id: " + newReservationId);
            //  Reload Reservation Page
            window.location.reload(true);
        } catch (e) {
            log.error(e.name, e);
        }
    }

    // ====== OnClick Revert Reservation Button ====
    function onRevertReservationClick(currentRecordId) {
        //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        //Load Reservation Transaction Record
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });

        // Only a cancelled reservation can be reverted
        if (reservationRecord.getValue("transtatus") !== "C") {
            alert("This reservation is not cancelled.");
            return;
        }

        var building = reservationRecord.getValue("location");
        var startDateStr = DateToString(
            format.parse({
                value: reservationRecord.getValue("startdate"),
                type: format.Type.DATE,
            })
        );
        var endDateStr = DateToString(
            format.parse({
                value: reservationRecord.getValue("enddate"),
                type: format.Type.DATE,
            })
        );

        // This reservation's own units (item sublist)
        var myUnits = [];
        var numLines = reservationRecord.getLineCount({ sublistId: "item" });
        for (var i = 0; i < numLines; i++) {
            myUnits.push(
                reservationRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "item",
                    line: i,
                })
            );
        }

        // Units taken by OTHER active reservations during the same period.
        // This cancelled reservation (status "C") is excluded by searchOccuipedUnits,
        // which only collects units from statusA / statusB reservations.
        var occupiedUnits = searchOccuipedUnits(building, startDateStr, endDateStr);

        var conflicts = myUnits.filter(function (unitId) {
            return occupiedUnits.indexOf(unitId) !== -1;
        });

        if (conflicts.length > 0) {
            alert(
                "لا يمكن استرجاع الحجز: الوحدات محجوزة في نفس الفترة.\n" +
                "Cannot revert: unit(s) are already booked for this period.\n" +
                "Unit IDs: " + conflicts.join(", ")
            );
            return;
        }

        // Period is clear → revert status to Pending Check-In ("A")
        reservationRecord.setValue("transtatus", "A");
        try {
            var newReservationId = reservationRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
            });
            log.debug("Reservation Reverted", "Id: " + newReservationId);
            //  Reload Reservation Page
            window.location.reload(true);
        } catch (e) {
            log.error(e.name, e);
            alert("Error reverting reservation: " + (e.message || e));
        }
    }

    function checkIn(reservationId) {
        // =============================
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });

        //Get Units Count
        var numLines = reservationRecord.getLineCount({
            sublistId: "item",
        });
        log.debug("Check IN ", "numLines: " + numLines);
        //Loop Units Record
        for (var i = 0; i < numLines; i++) {
            var sublistUnitValue = reservationRecord.getSublistValue({
                sublistId: "item",
                fieldId: "item",
                line: i,
            });

            //Load Unit Record
            var unit = record.load({
                type: "serviceitem",
                id: sublistUnitValue,
                isDynamic: true,
            });
            var currentStatus = unit.getValue("custitem_ns_property_status");
            log.debug("Check IN ", "Unit Current Status: " + currentStatus);
            // Check if unit is not Vacant (1) or Cleaning (3)
            if (currentStatus != "1" && currentStatus != "3") {
                log.debug("Unit [" + unit.getValue("itemid") + "] ", "Occupied");
                alert(
                    `
            الشقة ${unit.getValue("itemid")}
            ليست جاهزة لتسجيل الدخول. حالة الشقة فارغة\n
            Unit ${unit.getValue(
                        "itemid"
                    )} is not ready for check-in. Current status: Vacant

          `
                );
                return;
            } else {
                log.debug("Unit [" + unit.getValue("itemid") + "] ", "Vacant");
            }
        }
        log.debug("Units Finish Check ");
        for (var i = 0; i < numLines; i++) {
            var sublistUnitValue = reservationRecord.getSublistValue({
                sublistId: "item",
                fieldId: "item",
                line: i,
            });

            //Load Unit Record
            var unit = record.load({
                type: "serviceitem",
                id: sublistUnitValue,
                isDynamic: true,
            });
            var currentStatus = unit.getValue("custitem_ns_property_status");
            // Check if unit is not Vacant (1) or Cleaning (3)
            log.debug(
                "Unit [" + unit.getValue("itemid") + "] currentStatus: ",
                currentStatus
            );
            if (currentStatus != "1" && currentStatus != "3") {
                log.debug("Unit [" + unit.getValue("itemid") + "] ", "Occupied");
                alert(
                    `
            الشقة ${unit.getValue("itemid")}
            ليست جاهزة لتسجيل الدخول. حالة الشقة فارغة\n
            Unit ${unit.getValue(
                        "itemid"
                    )} is not ready for check-in. Current status: Vacant

          `
                );
                return;
            } else {
                log.debug("Unit [" + unit.getValue("itemid") + "] ", "Vacant");
                //Set Unit status To "Occupied"
                unit.setValue("custitem_ns_property_status", "2");
                //Save Unit Record
                try {
                    var unitId = unit.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                    });
                    log.debug("Unit Record Updated successfully", "Id: " + unitId);
                } catch (e) {
                    log.error(e.name, e);
                }
            }
        }
        // Update Reservation Status to "CheckIn"
        reservationRecord.setValue("transtatus", "B");

        try {
            // Save Reservation And Contract
            var newReservationId = reservationRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
            });
            log.debug(
                "Resrvation Record Status Updated successfully",
                "Id: " + newReservationId
            );
            //  Reload Reservation Page
            window.location.reload(true);
            // Redirect User To Contract Instance
            // var output = url.resolveRecord({
            //   recordType: "customsale_ns_contracts",
            //   recordId: contractId,
            //   isEditMode: true,
            // });
            // window.location.replace(output);
        } catch (e) {
            log.error(e.name, e);
        }
    }
    function onCreateContractClick(currentRecordId) {
        log.debug("Contract Create", "create contract" + currentRecordId);
        // console.log("Create Contracts", currentRecordId);
        // //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        //Load Reservation Transaction Record
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });
        // var btn = reservationRecord.getField({
        //   fieldId: "custpage_create_contract_btn",
        // });
        // btn.isDisabled = true;
        //Get Reservation Transaction Status (Must Be Pending CheckIn)
        var reservationCycle = reservationRecord.getValue(
            "custbody_ns_reservation_cycle"
        );
        var reservationStatus = reservationRecord.getValue("transtatus");
        var reservationStartDate = reservationRecord.getValue("startdate");
        var reservationEndDate = reservationRecord.getValue("enddate");
        var reservationPostingPeriod = reservationRecord.getValue("postingperiod");
        var reservationSalePerson = reservationRecord.getValue(
            "custbody_ns_sales_person"
        );
        var formatStartDate = format.parse({
            value: reservationStartDate,
            type: format.Type.DATE,
        });
        var formatEndDate = format.parse({
            value: reservationEndDate,
            type: format.Type.DATE,
        });
        var formatTodayDate = format.parse({
            value: new Date(),
            type: format.Type.DATE,
        });
        var todayDateStr = DateToString(formatTodayDate);
        var startDateStr = DateToString(formatStartDate);
        var endDateStr = DateToString(formatEndDate);

        var start_date = formatStartDate;
        var end_date = formatEndDate;
        var contracts;
        if (reservationCycle === "1") {
            // console.log("Contract Cycle ", reservationCycle);

            contracts = dailyPeriods(start_date, end_date);
            console.log("dailyPeriods ", contracts);
            log.debug("CheckedIn", "Res Cycle : Daily" + contracts.length);
        } else if (reservationCycle === "2") {
            contracts = monthlyPeriods2(start_date, end_date);
            log.debug("CheckedIn", "Res Cycle : Monthly" + contracts.length);
        }

        for (var j = 0; j < contracts.length; j++) {
            log.debug("Create Contract Test", "Contract " + contracts[j].days);
        }

        var contracts_ids = [];
        try {
            // Normalize period dates to ISO so the Suitelet doesn't have to guess locale.
            // dailyPeriods() returns Date objects; monthlyPeriods2() returns "DD/MM/YYYY" strings.
            var contractsPayload = [];
            for (var i = 0; i < contracts.length; i++) {
                contractsPayload.push({
                    start: toDateStamp(contracts[i].start),
                    end: toDateStamp(contracts[i].end),
                    days: contracts[i].days,
                });
            }

            var createContractsUrl = url.resolveScript({
                scriptId: "customscript_ns_sl_create_contracts",
                deploymentId: "customdeploy_ns_sl_create_contracts",
            });

            var slResponse = https.post({
                url: createContractsUrl,
                body: JSON.stringify({
                    reservationId: reservationId,
                    cycle: reservationCycle,
                    salesPerson: reservationSalePerson,
                    contracts: contractsPayload,
                }),
                headers: { "Content-Type": "application/json" },
            });

            console.log("Create Contracts Suitelet response", slResponse.code, slResponse.body);

            var result = JSON.parse(slResponse.body);
            if (!result || !result.success) {
                log.error("Contract creation failed", JSON.stringify(result));
                alert(
                    "Failed to create contracts: " +
                    ((result && result.error) || "Unknown error")
                );
                return;
            }

            contracts_ids = result.contractIds || [];
            console.log("Contracts created", contracts_ids);

            var commissionPerson = reservationRecord.getValue("custbody_ns_sales_person");
            if (commissionPerson) {
                var commissionPercent = reservationRecord.getValue("custbody_ns_commission_percent");
                var commissionAmount = reservationRecord.getValue("custbody_ns_commission_amount");
                if (commissionPercent || commissionAmount) {
                    createCommissionJournalEntry(reservationId);
                }
            }

            window.location.reload(true);
            jQuery("#_loading_dialog").dialog("destroy");
        } catch (e) {
            log.error("onCreateContractClick failed", (e && e.name) + " | " + (e && e.message));
            console.error("onCreateContractClick failed", e);
            alert("Error creating contracts: " + (e && e.message ? e.message : e));
            return;
        }

        // Create Journal Here
        var contractsString = contracts_ids.join(",");
        console.log("Creating Journals for this Contracts : ", contractsString);
        createJournalEntry(contractsString);
    }

    // ====== Search Contracts ========
    function searchContract(reservationId) {
        log.debug("Contract from Reservation", "Contract Search Begin ...");
        try {
            var contracts = [];
            var contractsSearch = search
                .create({
                    type: "customsale_ns_contracts",
                    title: "My Search Title",
                    columns: [
                        "tranid",
                        "createdfrom",
                        "amount",
                        "amountpaid",
                        "amountremaining",
                    ],
                    filters: [
                        {
                            name: "createdfrom",
                            operator: "is",
                            values: [reservationId],
                        },
                    ],
                })
                .run()
                .each(function (result) {
                    // Process each result
                    var internalId = result.getValue({
                        name: "tranid",
                    });
                    var fromRes = result.getValue({
                        name: "createdfrom",
                    });
                    var amountCont = result.getValue({
                        name: "amount",
                    });
                    var amountPaidCont = result.getValue({
                        name: "amountpaid",
                    });
                    var amountRemainCont = result.getValue({
                        name: "amountremaining",
                    });
                    if (internalId) {
                        log.debug(
                            "Contract from Reservation",
                            "Contract Id: " + internalId + " From Reservation" + fromRes
                        );
                        // log.debug(
                        //   "Contract from Reservation",
                        //   "Contract Amounts: " +
                        //     " Total = " +
                        //     amountCont +
                        //     " Paid = " +
                        //     amountPaidCont +
                        //     " Remaining" +
                        //     amountRemainCont
                        // );
                        // if (parseFloat(amountRemainCont) > 0) {
                        //   var options = {
                        //     title: "تنويه",
                        //     message:
                        //       "لم يتم إستخلاص كامل مستحقات العميل. يجب إنشاء سند قبض بقيمة " +
                        //       amountRemainCont,
                        //     buttons: [
                        //       { label: "إلغاء", value: 1 },
                        //       { label: "تسجيل خروج", value: 2 },
                        //     ],
                        //   };
                        //   function success(result) {
                        //     if (result == 1) {
                        //       // console.log("إلغاء");
                        //     } else if (result == 2) {
                        //       // console.log("تسجيل جروج");
                        //       checkout(reservationId);
                        //       //  Reload Reservation Page
                        //       window.location.reload(true);
                        //     }
                        //   }
                        //   function failure(reason) {
                        //     console.log("Failure: " + reason);
                        //   }
                        //   dialog.create(options).then(success).catch(failure);
                        // }
                        contracts.push(internalId);
                    }

                    return true;
                });

            if (contracts.length === 0) {
                var options = {
                    title: "تنويه",
                    message:
                        "لا يوجد عقد  مرتبط بهذا الحجز. هل أنت متأكد من تسجيل الخروج؟",
                    buttons: [
                        { label: "إلغاء", value: 1 },
                        { label: "تسجيل خروج", value: 2 },
                    ],
                };
                function success(result) {
                    if (result == 1) {
                        //   console.log("إلغاء");
                    } else if (result == 2) {
                        //   console.log("تسجيل جروج");
                        checkout(reservationId);

                        // Customer Rating

                        //  Redirect to Customer Rating Page
                        // window.location.reload(true);
                    }
                }
                function failure(reason) {
                    console.log("Failure: " + reason);
                }
                dialog.create(options).then(success).catch(failure);
            } else {
                checkout(reservationId);
                //  Reload Reservation Page
                // window.location.reload(true);
                // var rec = currentRecord.get();
                // var customerId = rec.getValue("entity");
                //   var output = url.resolveScript({
                //     scriptId: "customscript_ns_slt_customer_rating",
                //     deploymentId: "customdeploy_ns_slt_customer_rating",
                //   });
                //   output = output + "&customer=" + customerId + "&reservation="+reservationId;
                //   var newwindow = window.open(output, "_blank");
            }
        } catch (e) {
            log.error(e.name, e);
        }
    }
    function onPaymentClick(currentRecordId) {
        try {
            var reservationId = parseInt(currentRecordId);
            console.log("Payment Clicked from Reservation: ", reservationId);
            var reservationRecord = record.load({
                type: "customsale_ns_reservations",
                id: reservationId,
            });

            //Get Reservation Transaction Status (Must Be Pending CheckIn)
            var reservationEntity = reservationRecord.getValue("entity");
            window.open(
                "/app/accounting/transactions/custpymt.nl?entity=" +
                reservationEntity +
                "&currency=1" +
                "&whence=",
                "_self"
            );
        } catch (error) {
            console.log("onPaymentClick ERROR");
        }
    }
    // ========= Credit Memo ========
    function onCreditMemoButtonClick(currentRecordId) {
        //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        //Load Reservation Transaction Record
        var reservationRecord = record.load({
            type: "customsale_ns_reservations",
            id: reservationId,
        });

        //Get Reservation Transaction Status (Must Be Pending CheckIn)
        var reservationStatus = reservationRecord.getValue("transtatus");
        var reservationStartDate = reservationRecord.getValue("startdate");
        var reservationEndDate = reservationRecord.getValue("enddate");
        var formatStartDate = format.parse({
            value: reservationStartDate,
            type: format.Type.DATE,
        });
        var formatEndDate = format.parse({
            value: reservationEndDate,
            type: format.Type.DATE,
        });
        var formatTodayDate = format.parse({
            value: new Date(),
            type: format.Type.DATE,
        });
        var todayDateStr = DateToString(formatTodayDate);
        var startDateStr = DateToString(formatStartDate);
        var endDateStr = DateToString(formatEndDate);

        var startDay = formatStartDate.getDate();
        var startMonth = formatStartDate.getMonth() + 1;
        var startYear = formatStartDate.getFullYear();

        var endDay = formatEndDate.getDate();
        var endMonth = formatEndDate.getMonth() + 1;
        var endYear = formatEndDate.getFullYear();
        log.debug({
            title: "Credit Memo",
            details: "Add Credit Memo to Reservation" + reservationId,
        });
        window.open(
            "/app/accounting/transactions/cutrsale.nl?customtype=102&e=T&id=" +
            reservationId +
            "&memdoc=0&transform=cutrsale101&compid=11661334&record.custbody_ns_end_date_field=" +
            endDay +
            "%2F" +
            endMonth +
            "%2F" +
            endYear +
            "&record.memo=From+Reservation&record.custbody_ns_start_date_field=" +
            startDay +
            "%2F" +
            startMonth +
            "%2F" +
            startYear +
            "&whence=",
            "_self"
        );
        // window.open(
        //   "/app/accounting/transactions/custcred.nl?e=T&id=" +
        //     reservationId +
        //     "&memdoc=0&transform=cutrsale109&compid=11661334&record.custbody_ns_end_date_field=" +
        //     endDay +
        //     "%2F" +
        //     endMonth +
        //     "%2F" +
        //     endYear +
        //     "&record.memo=From+Reservation&record.custbody_ns_start_date_field=" +
        //     startDay +
        //     "%2F" +
        //     startMonth +
        //     "%2F" +
        //     startYear +
        //     "&whence=",
        //   "_self"
        // );
    }

    // ====== End Search Contracts ====

    // ====== OnClick Check Out Button ====
    function onCheckOutButtonClick(currentRecordId) {
        //Get Reservation Internal ID from UserEvent Script
        var reservationId = parseInt(currentRecordId);

        try {
            //Load Reservation Transaction Record
            var reservationRecord = record.load({
                type: "customsale_ns_reservations",
                id: reservationId,
            });

            //Get Reservation Transaction Status (Must Be Pending CheckIn)
            var reservationStatus = reservationRecord.getValue("transtatus");
            var reservationStartDate = reservationRecord.getValue("startdate");
            var reservationEndDate = reservationRecord.getValue("enddate");
            var formatStartDate = format.parse({
                value: reservationStartDate,
                type: format.Type.DATE,
            });
            var formatEndDate = format.parse({
                value: reservationEndDate,
                type: format.Type.DATE,
            });
            var formatTodayDate = format.parse({
                value: new Date(),
                type: format.Type.DATE,
            });
            var todayDateStr = DateToString(formatTodayDate);
            var startDateStr = DateToString(formatStartDate);
            var endDateStr = DateToString(formatEndDate);

            if (todayDateStr < endDateStr) {
                var options = {
                    title: "تنويه",
                    message:
                        "الشقق مشغولة حاليا و العميل  سيغادر يوم " +
                        endDateStr +
                        "هل اأنت متأكد من تسجيل الخروج؟",
                    buttons: [
                        { label: "إلغاء", value: 1 },
                        { label: "تسجيل خروج", value: 2 },
                    ],
                };
                function success(result) {
                    if (result == 1) {
                        //   console.log("إلغاء");
                    } else if (result == 2) {
                        //   console.log("تسجيل جروج");
                        searchContract(reservationId);
                    }
                }
                function failure(reason) {
                    console.log("Failure: " + reason);
                }
                dialog.create(options).then(success).catch(failure);
            } else if (todayDateStr > endDateStr) {
                var options = {
                    title: "تنويه",
                    message:
                        "تاريخ تسجيل الخروج " +
                        endDateStr +
                        " قبل تاريخ اليوم " +
                        todayDateStr,
                    buttons: [
                        { label: "إلغاء", value: 1 },
                        { label: "تسجيل خروج", value: 2 },
                    ],
                };
                function success(result) {
                    if (result == 1) {
                        //   console.log("إلغاء");
                    } else if (result == 2) {
                        //   console.log("تسجيل جروج");
                        searchContract(reservationId);
                    }
                }
                function failure(reason) {
                    console.log("Failure: " + reason);
                }
                dialog.create(options).then(success).catch(failure);
            } else {
                // Search Contracts Realated to This Reservation
                console.log("تسجيل جروج");
                searchContract(reservationId);
            }
        } catch (error) {
            log.audit({
                title: "Error In CheckOut",
                details: "Error Message = " + error.message,
            });
        }
    }

    function checkout(reservationId) {
        // console.log("Checkout Done");
        log.debug("CheckOut", "Checkout Done");
        //Save Unit Record
        try {
            var reservationRecord = record.load({
                type: "customsale_ns_reservations",
                id: reservationId,
            });
            var customerId = reservationRecord.getValue("entity");
            console.log("Customer ID = " + customerId);
            //Get Units Count
            var numLines = reservationRecord.getLineCount({
                sublistId: "item",
            });

            //Loop Units Record
            for (var i = 0; i < numLines; i++) {
                var sublistUnitValue = reservationRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "item",
                    line: i,
                });

                //Load Unit Record
                var unit = record.load({
                    type: "serviceitem",
                    id: sublistUnitValue,
                    isDynamic: true,
                });

                //Set Unit status To "Cleaning"
                unit.setValue("custitem_ns_property_status", "3");

                var unitId = unit.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                });
                console.log("Unit Record Updated successfully");
                log.debug("Unit Record Updated successfully", "Id: " + unitId);
            }
            // Update Reservation Status to "CheckedOut"
            console.log("Update Reservation Status to CheckedOut");
            reservationRecord.setValue("transtatus", "D");

            // Save Reservation And Contract
            var newReservationId = reservationRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
            });
            log.debug(
                "Resrvation Record Status Updated successfully",
                "Id: " + newReservationId
            );

            if (newReservationId) {
                var output = url.resolveScript({
                    scriptId: "customscript_ns_slt_customer_rating",
                    deploymentId: "customdeploy_ns_slt_customer_rating",
                });
                output =
                    output + "&customer=" + customerId + "&reservation=" + reservationId;
                var newwindow = window.open(output, "_self");
            }
        } catch (e) {
            log.error(e.name, e);
            console.log("Error Check Out ", e);
        }
    }
    // ====== OnClick Add Units Button ====

    function onAddUnits() {
        var rec = currentRecord.get();
        var dateStart = rec.getValue("startdate");
        var reservationCycle = rec.getValue("custbody_ns_reservation_cycle");
        var period = rec.getValue("custbody_ns_res_period");
        var building = rec.getValue("location");
        // Remove All Units
        var numItemLines = rec.getLineCount({
            sublistId: "item",
        });
        // Remove All line from Availbale Units Sublist
        if (numItemLines > 0) {
            for (var i = numItemLines; i > 0; i--) {
                rec.removeLine({
                    sublistId: "item",
                    line: i - 1,
                    ignoreRecalc: true,
                });
            }
        }
        // log.debug({
        // 	title: "onAddunits",
        // 	details: "Add Units to Sublist Items" + dateStart,
        // });

        console.log("onAddunits");

        var numLines = rec.getLineCount({
            sublistId: "custpage_availbale_units",
        });

        if (numLines > 0) {
            for (var i = 0; i < numLines; i++) {
                var unitCheck = rec.getSublistValue({
                    sublistId: "custpage_availbale_units",
                    fieldId: "custpage_units_check",
                    line: i,
                });
                var unitId = rec.getSublistValue({
                    sublistId: "custpage_availbale_units",
                    fieldId: "custpage_units_id",
                    line: i,
                });
                console.log(
                    "Unit Line [" + i + "] ",
                    "Unit: " + unitId + " Check: " + unitCheck
                );

                if (unitCheck) {
                    // log.debug({
                    // 	title: "Add Unit",
                    // 	details: "Add Units " + unitId + " to Sublist Items",
                    // });
                    console.log("Add Units " + unitId + " to Sublist Items");
                    var line = rec.getCurrentSublistIndex({
                        sublistId: "item",
                    });
                    rec.insertLine({
                        sublistId: "item",
                        line: line,
                    });
                    rec.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: unitId, // 11 is the internal id of the fixed line item
                        ignoreFieldChange: false,
                        forceSyncSourcing: true,
                    });
                    rec.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: period, // 11 is the internal id of the fixed line item
                        ignoreFieldChange: false,
                        forceSyncSourcing: true,
                    });
                    if (reservationCycle === "2") {
                        // log.debug({
                        // 	title: "Add Unit",
                        // 	details: "Cycle " + reservationCycle + " = month",
                        // });
                        console.log("Cycle " + reservationCycle + " = month");
                        rec.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "units",
                            value: 87,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                        rec.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "price",
                            value: 12,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                    } else {
                        log.debug({
                            title: "Add Unit",
                            details: "Cycle " + reservationCycle + " = day",
                        });
                        rec.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "units",
                            value: 86,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                        rec.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "price",
                            value: 1,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                        rec.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "location",
                            value: building,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                    }
                    rec.commitLine("item");
                }
            }
        } else {
            alert("There's No Units to Add");
        }
    }
    function getMonthDifference(startDate, endDate) {
        return (
            endDate.getMonth() -
            startDate.getMonth() +
            12 * (endDate.getFullYear() - startDate.getFullYear())
        );
    }
    function addMonthsToDate(numOfMonths, date) {
        date.setMonth(date.getMonth() + numOfMonths);

        return date;
    }
    function addDaysToDate(numOfDays, date) {
        date.setDate(date.getDate() + numOfDays);

        return date;
    }

    function postSourcing(context) {
        var currentRecord = context.currentRecord;
        var fieldId = context.fieldId;
        if (fieldId === "entity") {
            // console.log(
            //   "PostSourcing Customer " + currentRecord.getValue("salesrep")
            // );
            var customer_id = currentRecord.getValue("entity");
            var customer_salesrep = currentRecord.getValue("salesrep");
            var userObj = runtime.getCurrentUser();
            // var customerLookUp = search.lookupFields({
            //   type: search.Type.CUSTOMER,
            //   id: customer_id,
            //   columns: ["salesrep"],
            // });
            // console.log("Current User " + userObj.id);
            if (customer_salesrep != userObj.id) {
                currentRecord.setValue({
                    fieldId: "salesrep",
                    value: userObj.id,
                });
            }
        }
    }

    function fieldChanged(context) {
        if (flag != "script") {
            flag = "script"; //added by script

            var currentRecord = context.currentRecord;
            var sublistName = context.sublistId;
            var fieldName = context.fieldId;
            console.log("sublistName: ", sublistName);
            console.log("fieldName: ", fieldName);
            var startDate = currentRecord.getValue("startdate");
            var endDate = currentRecord.getValue("enddate");

            var formatStartDate = format.parse({
                value: startDate,
                type: format.Type.DATE,
            });
            var formatEndDate = format.parse({
                value: endDate,
                type: format.Type.DATE,
            });

            var reservationCycle = currentRecord.getValue(
                "custbody_ns_reservation_cycle"
            );

            // ============== When Identification/Passport Number Changed ==============
            if (fieldName === "custbody_ns_id_passport_num") {
                var customerPassportId = currentRecord.getValue(
                    "custbody_ns_id_passport_num"
                );
                var customerSearch = search.create({
                    type: search.Type.CUSTOMER,
                    title: "Reservation Customer Search",
                    id: "customsearch_res_cust_search",
                    columns: [
                        "internalid",
                        "entityid",
                        "custentity38",
                        "custentity_ns_id_passport_num",
                    ],
                    filters: [
                        ["custentity_ns_id_passport_num", "is", customerPassportId],
                        "and",
                        ["subsidiary", "anyof", "2"],
                        "and",
                        ["isinactive", "is", "false"],
                    ],
                });
                var customerSearched = [];
                customerSearch.run().each(function (result) {
                    var customerInternalId = result.getValue({
                        name: "internalid",
                    });
                    var customerEntityId = result.getValue({
                        name: "entityid",
                    });
                    var customerPassport = result.getValue({
                        name: "custentity_ns_id_passport_num",
                    });
                    var customerFullName = result.getValue({
                        name: "custentity38",
                    });

                    // console.log(
                    //   "We Find Customer with this Passport ID (" +
                    //     customerPassportId +
                    //     ") => ID : " +
                    //     customerInternalId +
                    //     " Entity : " +
                    //     customerEntityId +
                    //     " Pass ID : " +
                    //     customerPassport
                    // );
                    if (customerPassport != "") {
                        customerSearched.push({
                            internalid: customerInternalId,
                            entityId: customerEntityId,
                            fullName: customerFullName,
                            passNum: customerPassport,
                        });
                    }

                    return true;
                });
                if (customerSearched.length > 1) {
                    var customerNames = "";
                    for (var i = 0; i < customerSearched.length; i++) {
                        var cust = customerSearched[i];
                        customerNames =
                            customerNames +
                            " * " +
                            cust.entityId +
                            " " +
                            cust.fullName +
                            " \n";
                    }
                    alert(
                        "يوجد أكثر من عميل بنفس رقم الهوية" +
                        " \n " +
                        "There is more than one customer with the same ID number. \n " +
                        customerNames
                    );
                    currentRecord.setValue({
                        fieldId: "custbody_ns_id_passport_num",
                        value: "",
                    });
                } else if (customerSearched.length == 1) {
                    currentRecord.setValue({
                        fieldId: "entity",
                        value: customerSearched[0].internalid,
                    });
                } else {
                    alert(
                        "لا يوجد عميل بهذا الرقم. \n الرجاء كتابة إسم العميل أو إنشأ عميل جديد." +
                        " \n " +
                        "There is no customer with this number. " +
                        "\n" +
                        "Please type in the customer's name or create a new customer."
                    );
                    currentRecord.setValue({
                        fieldId: "custbody_ns_id_passport_num",
                        value: "",
                    });
                }
            }

            // ============== When Reservation Cycle Changed ==============
            if (fieldName === "custbody_ns_reservation_cycle") {
                var endDateField = currentRecord.getField({
                    fieldId: "enddate",
                });
                if (reservationCycle === "2") {
                    endDateField.isDisabled = true;
                    log.debug("Cycle Changed", "Reservation cycle = " + reservationCycle);
                    var months = getMonthDifference(formatStartDate, formatEndDate);
                    // if (
                    //   formatEndDate.toDateString() ==
                    //   getDateEndOfMonth(formatEndDate).toDateString()
                    // ) {
                    //   months += 1;
                    // }
                    if (parseInt(months) > 0) {
                        var monthlyEndDate = addMonthsToDate(months, formatStartDate);
                        var monthlyEndDateFormated = format.parse({
                            value: monthlyEndDate,
                            type: format.Type.DATE,
                        });
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: monthlyEndDateFormated,
                        });
                        currentRecord.setValue({
                            fieldId: "custbody_ns_res_period",
                            value: parseInt(months),
                        });
                    } else {
                        var monthlyEndDate = addMonthsToDate(1, formatStartDate);
                        var monthlyEndDateFormated = format.parse({
                            value: monthlyEndDate,
                            type: format.Type.DATE,
                        });
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: monthlyEndDateFormated,
                        });
                        currentRecord.setValue({
                            fieldId: "custbody_ns_res_period",
                            value: 1,
                        });
                    }
                    var unitsLinesCount = currentRecord.getLineCount({
                        sublistId: "item",
                    });
                    if (unitsLinesCount > 0) {
                        var period = currentRecord.getValue({
                            fieldId: "custbody_ns_res_period",
                        });
                        for (var i = 0; i < unitsLinesCount; i++) {
                            var line = currentRecord.selectLine({
                                sublistId: "item",
                                line: i,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                value: period,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "units",
                                value: 87,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "price",
                                value: 12,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.commitLine("item");
                        }
                    }
                } else {
                    endDateField.isDisabled = true;
                    var periodInSeconds = formatEndDate - formatStartDate;
                    var total_seconds = parseInt(Math.floor(periodInSeconds / 1000));
                    var total_minutes = parseInt(Math.floor(total_seconds / 60));
                    var total_hours = parseInt(Math.floor(total_minutes / 60));
                    var days = parseInt(Math.floor(total_hours / 24));

                    currentRecord.setValue({
                        fieldId: "custbody_ns_res_period",
                        value: parseInt(days),
                    });
                    var unitsLinesCount = currentRecord.getLineCount({
                        sublistId: "item",
                    });
                    if (unitsLinesCount > 0) {
                        var period = currentRecord.getValue({
                            fieldId: "custbody_ns_res_period",
                        });
                        for (var i = 0; i < unitsLinesCount; i++) {
                            var line = currentRecord.selectLine({
                                sublistId: "item",
                                line: i,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                value: period,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.commitLine("item");
                        }
                    }
                }
                var numLines = currentRecord.getLineCount({
                    sublistId: "item",
                });
                if (numLines > 0) {
                    for (var i = 0; i < numLines; i++) {
                        currentRecord.selectLine({
                            sublistId: "item",
                            line: i,
                        });
                        if (reservationCycle === "2") {
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "units",
                                value: 87,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "price",
                                value: 12,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                        } else {
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "units",
                                value: 86,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "price",
                                value: 1,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                        }
                        currentRecord.commitLine("item");
                    }
                }
            }

            // ============== When Start Date  Or End Date Changed ==============
            if (fieldName === "enddate" || fieldName === "startdate") {
                log.debug(
                    "Date field Changed",
                    "Reservation Cycle: " + reservationCycle
                );
                // ============== If Reservation Cycle Monthly ==============
                if (reservationCycle === "2") {
                    // ============== If Reservation End date > Start ==============
                    if (formatEndDate < formatStartDate) {
                        alert("Start Date cannot be greater than End Date ");
                        var newEndDate = formatEndDate.setMonth(
                            formatStartDate.getMonth() + 1
                        );
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: new Date(newEndDate),
                        });
                    } else {
                        var periodInSeconds = formatEndDate - formatStartDate;
                        var total_seconds = parseInt(Math.floor(periodInSeconds / 1000));
                        var total_minutes = parseInt(Math.floor(total_seconds / 60));
                        var total_hours = parseInt(Math.floor(total_minutes / 60));
                        var days = parseInt(Math.floor(total_hours / 24));
                        var months = getMonthDifference(formatStartDate, formatEndDate);
                        log.debug(
                            "Date field Changed",
                            "Period When Change Date field in Monthly Cycle " + months
                        );
                        // if (
                        //   formatEndDate.toDateString() ==
                        //   getDateEndOfMonth(formatEndDate).toDateString()
                        // ) {
                        //   months += 1;
                        // }
                        if (parseInt(months) > 0) {
                            log.debug(
                                "Date field Changed",
                                "Reservation Period in month " + months
                            );
                            currentRecord.setValue({
                                fieldId: "custbody_ns_res_period",
                                value: parseInt(months),
                            });
                        } else {
                            currentRecord.setValue({
                                fieldId: "custbody_ns_res_period",
                                value: parseInt(days),
                            });
                            currentRecord.setValue({
                                fieldId: "custbody_ns_reservation_cycle",
                                value: "1",
                            });
                        }

                        var unitsLinesCount = currentRecord.getLineCount({
                            sublistId: "item",
                        });
                        log.debug("Date field Changed", "Lines Counts: " + unitsLinesCount);
                        if (unitsLinesCount > 0) {
                            var period = currentRecord.getValue({
                                fieldId: "custbody_ns_res_period",
                            });
                            for (var i = 0; i < unitsLinesCount; i++) {
                                var line = currentRecord.selectLine({
                                    sublistId: "item",
                                    line: i,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "quantity",
                                    value: period,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "units",
                                    value: 87,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "price",
                                    value: 12,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });

                                currentRecord.commitLine("item");
                            }
                        }
                    }
                    // ============== If Reservation Cycle Daily ==============
                } else {
                    if (formatEndDate < formatStartDate) {
                        alert("Start Date cannot be greater than End Date ");
                        var newEndDate = formatEndDate.setDate(
                            formatStartDate.getDate() + 1
                        );
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: new Date(newEndDate),
                        });
                    } else {
                        var periodInSeconds = formatEndDate - formatStartDate;
                        var total_seconds = parseInt(Math.floor(periodInSeconds / 1000));
                        var total_minutes = parseInt(Math.floor(total_seconds / 60));
                        var total_hours = parseInt(Math.floor(total_minutes / 60));
                        var days = parseInt(Math.floor(total_hours / 24));

                        currentRecord.setValue({
                            fieldId: "custbody_ns_res_period",
                            value: parseInt(days),
                        });
                        var unitsLinesCount = currentRecord.getLineCount({
                            sublistId: "item",
                        });
                        log.debug("Date field Changed", "Lines Counts: " + unitsLinesCount);
                        if (unitsLinesCount > 0) {
                            var period = currentRecord.getValue({
                                fieldId: "custbody_ns_res_period",
                            });
                            for (var i = 0; i < unitsLinesCount; i++) {
                                var line = currentRecord.selectLine({
                                    sublistId: "item",
                                    line: i,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "quantity",
                                    value: period,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "units",
                                    value: 86,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "price",
                                    value: 1,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });

                                currentRecord.commitLine("item");
                            }
                        }
                    }
                } // End Reservation Cycle
            } // End Start Or End Dates Changed

            // ======= Search Units whithout Reservations between StartDate & EndDate =====
            if (
                fieldName === "location" ||
                fieldName === "startdate" ||
                fieldName === "enddate"
            ) {
                var buildingLocation = currentRecord.getValue({
                    fieldId: "location",
                });
                if (buildingLocation) {
                    if (
                        buildingLocation == "85" ||
                        buildingLocation == "86" ||
                        buildingLocation == "87"
                    ) {
                        alert(
                            "الرجاء إختيار البناية الصحيحة. \n Please Choose the correct Building"
                        );
                        currentRecord.setValue({
                            fieldId: "location",
                            value: "",
                        });
                    }
                    //   currentRecord.setValue({
                    //     fieldId: "location",
                    //     value: buildingLocation,
                    //   });
                    var currentStartDate = currentRecord.getValue({
                        fieldId: "startdate",
                    });
                    var currentEndDate = currentRecord.getValue({
                        fieldId: "enddate",
                    });
                    var currentStartDateStr = DateToString(new Date(currentStartDate));
                    var currentEndDateStr = DateToString(new Date(currentEndDate));

                    var sublistChanged = context.sublistId;
                    if (sublistChanged == null) {
                        var allUnits = searchAllUnits(buildingLocation);
                        var occupiedUnits = searchOccuipedUnits(
                            buildingLocation,
                            currentStartDateStr,
                            currentEndDateStr
                        );

                        if (allUnits.length > 0) {
                            var vacantUnits = allUnits.filter(function (value, index, arr) {
                                return !occupiedUnits.includes(value.id);
                            });
                            refreshUnitTypeFilterOptions(currentRecord, allUnits);
                            vacantUnits = applyTypeFilter(currentRecord, vacantUnits);
                            if (vacantUnits.length > 0) {
                                var numLines = currentRecord.getLineCount({
                                    sublistId: "custpage_availbale_units",
                                });
                                // Remove All line from Availbale Units Sublist
                                if (numLines > 0) {
                                    for (var i = numLines; i > 0; i--) {
                                        currentRecord.removeLine({
                                            sublistId: "custpage_availbale_units",
                                            line: i - 1,
                                            ignoreRecalc: true,
                                        });
                                    }
                                }

                                for (var i = 0; i < vacantUnits.length; i++) {
                                    currentRecord.selectNewLine("custpage_availbale_units");
                                    currentRecord.setCurrentSublistValue(
                                        "custpage_availbale_units",
                                        "custpage_units_id",
                                        vacantUnits[i].id
                                    );

                                    currentRecord.setCurrentSublistValue(
                                        "custpage_availbale_units",
                                        "custpage_units_list",
                                        vacantUnits[i].name
                                    );
                                    currentRecord.setCurrentSublistValue(
                                        "custpage_availbale_units",
                                        "custpage_units_status",
                                        vacantUnits[i].status
                                    );
                                    currentRecord.setCurrentSublistValue(
                                        "custpage_availbale_units",
                                        "custpage_units_type",
                                        vacantUnits[i].type
                                    );
                                    currentRecord.setCurrentSublistValue(
                                        "custpage_availbale_units",
                                        "custpage_units_building",
                                        vacantUnits[i].building
                                    );
                                    currentRecord.commitLine("custpage_availbale_units");
                                }
                            }
                            var numItemLines = currentRecord.getLineCount({
                                sublistId: "item",
                            });
                            // Remove All line from Availbale Units Sublist
                            if (numItemLines > 0) {
                                for (var i = 0; i < numItemLines; i++) {
                                    var line = currentRecord.selectLine({
                                        sublistId: "item",
                                        line: i,
                                    });
                                    var lineItemVal = currentRecord.getCurrentSublistValue({
                                        sublistId: "item",
                                        fieldId: "item",
                                    });
                                    if (occupiedUnits.includes(lineItemVal)) {
                                        alert(
                                            "الشقة مشغولة في هذا التاريخ. الرجاء تغير الشقة أو تغيير التاريخ."
                                        );
                                    }
                                    currentRecord.commitLine("item");
                                }
                            }
                        }
                    }
                    // Rank the freshly-loaded units and flag the best one to book.
                    highlightRecommendedUnit(
                        currentRecord,
                        buildingLocation,
                        currentStartDate,
                        currentEndDate,
                        currentRecord.id
                    );
                } else {
                    // Remove All Units
                    var numLines = currentRecord.getLineCount({
                        sublistId: "custpage_availbale_units",
                    });
                    // Remove All line from Availbale Units Sublist
                    if (numLines > 0) {
                        for (var i = numLines; i > 0; i--) {
                            currentRecord.removeLine({
                                sublistId: "custpage_availbale_units",
                                line: i - 1,
                                ignoreRecalc: true,
                            });
                        }
                    }
                }
            }
            if (fieldName === "custbody_ns_res_period") {
                var reservationPeriod = currentRecord.getValue(
                    "custbody_ns_res_period"
                );
                if (reservationCycle === "2") {
                    log.debug(
                        "Period Changed",
                        "Reservation Period = " + reservationPeriod
                    );
                    if (parseInt(reservationPeriod) > 0) {
                        var monthlyEndDate = addMonthsToDate(
                            reservationPeriod,
                            formatStartDate
                        );
                        var monthlyEndDateFormated = format.parse({
                            value: monthlyEndDate,
                            type: format.Type.DATE,
                        });
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: monthlyEndDateFormated,
                        });
                    } else {
                        var monthlyEndDate = addMonthsToDate(1, formatStartDate);
                        var monthlyEndDateFormated = format.parse({
                            value: monthlyEndDate,
                            type: format.Type.DATE,
                        });
                        currentRecord.setValue({
                            fieldId: "enddate",
                            value: monthlyEndDateFormated,
                        });
                        currentRecord.setValue({
                            fieldId: "custbody_ns_res_period",
                            value: 1,
                        });
                    }
                    var unitsLinesCount = currentRecord.getLineCount({
                        sublistId: "item",
                    });
                    if (unitsLinesCount > 0) {
                        for (var i = 0; i < unitsLinesCount; i++) {
                            var line = currentRecord.selectLine({
                                sublistId: "item",
                                line: i,
                            });
                            currentRecord.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                value: reservationPeriod,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true,
                            });
                            currentRecord.commitLine("item");
                        }
                    }
                } else {
                    try {
                        log.debug(
                            "Period Changed",
                            "Reservation Period = " + reservationPeriod
                        );
                        if (parseInt(reservationPeriod) > 0) {
                            var monthlyEndDate = addDaysToDate(
                                reservationPeriod,
                                formatStartDate
                            );
                            var monthlyEndDateFormated = format.parse({
                                value: monthlyEndDate,
                                type: format.Type.DATE,
                            });
                            currentRecord.setValue({
                                fieldId: "enddate",
                                value: monthlyEndDateFormated,
                            });
                        } else {
                            var monthlyEndDate = addDaysToDate(1, formatStartDate);
                            var monthlyEndDateFormated = format.parse({
                                value: monthlyEndDate,
                                type: format.Type.DATE,
                            });
                            currentRecord.setValue({
                                fieldId: "enddate",
                                value: monthlyEndDateFormated,
                            });
                            currentRecord.setValue({
                                fieldId: "custbody_ns_res_period",
                                value: "1",
                            });
                        }
                        var unitsLinesCount = currentRecord.getLineCount({
                            sublistId: "item",
                        });
                        if (unitsLinesCount > 0) {
                            for (var i = 0; i < unitsLinesCount; i++) {
                                var line = currentRecord.selectLine({
                                    sublistId: "item",
                                    line: i,
                                });
                                currentRecord.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "quantity",
                                    value: reservationPeriod,
                                    ignoreFieldChange: false,
                                    forceSyncSourcing: true,
                                });
                                currentRecord.commitLine("item");
                            }
                        }

                        var buildingLocation = currentRecord.getValue({
                            fieldId: "location",
                        });
                        if (buildingLocation) {
                            // Update Occuiped Units
                            var currentStartDate = currentRecord.getValue({
                                fieldId: "startdate",
                            });
                            var currentEndDate = currentRecord.getValue({
                                fieldId: "enddate",
                            });
                            var currentStartDateStr = DateToString(
                                new Date(currentStartDate)
                            );
                            var currentEndDateStr = DateToString(new Date(currentEndDate));

                            var sublistChanged = context.sublistId;
                            if (sublistChanged == null) {
                                var allUnits = searchAllUnits(buildingLocation);
                                var occupiedUnits = searchOccuipedUnits(
                                    buildingLocation,
                                    currentStartDateStr,
                                    currentEndDateStr
                                );

                                if (allUnits.length > 0) {
                                    var vacantUnits = allUnits.filter(function (
                                        value,
                                        index,
                                        arr
                                    ) {
                                        return !occupiedUnits.includes(value.id);
                                    });
                                    refreshUnitTypeFilterOptions(currentRecord, allUnits);
                                    vacantUnits = applyTypeFilter(currentRecord, vacantUnits);
                                    if (vacantUnits.length > 0) {
                                        var numLines = currentRecord.getLineCount({
                                            sublistId: "custpage_availbale_units",
                                        });
                                        // Remove All line from Availbale Units Sublist
                                        if (numLines > 0) {
                                            for (var i = numLines; i > 0; i--) {
                                                currentRecord.removeLine({
                                                    sublistId: "custpage_availbale_units",
                                                    line: i - 1,
                                                    ignoreRecalc: true,
                                                });
                                            }
                                        }

                                        for (var i = 0; i < vacantUnits.length; i++) {
                                            currentRecord.selectNewLine("custpage_availbale_units");
                                            currentRecord.setCurrentSublistValue(
                                                "custpage_availbale_units",
                                                "custpage_units_id",
                                                vacantUnits[i].id
                                            );

                                            currentRecord.setCurrentSublistValue(
                                                "custpage_availbale_units",
                                                "custpage_units_list",
                                                vacantUnits[i].name
                                            );
                                            currentRecord.setCurrentSublistValue(
                                                "custpage_availbale_units",
                                                "custpage_units_status",
                                                vacantUnits[i].status
                                            );
                                            currentRecord.setCurrentSublistValue(
                                                "custpage_availbale_units",
                                                "custpage_units_type",
                                                vacantUnits[i].type
                                            );
                                            currentRecord.setCurrentSublistValue(
                                                "custpage_availbale_units",
                                                "custpage_units_building",
                                                vacantUnits[i].building
                                            );
                                            currentRecord.commitLine("custpage_availbale_units");
                                        }
                                    }
                                    var numItemLines = currentRecord.getLineCount({
                                        sublistId: "item",
                                    });
                                    // Remove All line from Availbale Units Sublist
                                    if (numItemLines > 0) {
                                        for (var i = 0; i < numItemLines; i++) {
                                            var line = currentRecord.selectLine({
                                                sublistId: "item",
                                                line: i,
                                            });
                                            var lineItemVal = currentRecord.getCurrentSublistValue({
                                                sublistId: "item",
                                                fieldId: "item",
                                            });
                                            if (occupiedUnits.includes(lineItemVal)) {
                                                alert(
                                                    "الشقة مشغولة في هذا التاريخ. الرجاء تغير الشقة أو تغيير التاريخ."
                                                );
                                            }
                                            currentRecord.commitLine("item");
                                        }
                                    }
                                }
                            }
                            // Rank the freshly-loaded units and flag the best one to book.
                            highlightRecommendedUnit(
                                currentRecord,
                                buildingLocation,
                                currentStartDate,
                                currentEndDate,
                                currentRecord.id
                            );
                        }
                    } catch (error) {
                        console.log("Handle Daily Reservation ERROR", error);
                    }
                }
            }

            // ======== Change Sublist Field ==> Amount ===========
            if (sublistName === "item" && fieldName === "amount") {
                // console.log("Edit Sublist", "Update Sublist Item ...");
                var cycle = currentRecord.getValue("custbody_ns_reservation_cycle");
                var currentLocation = currentRecord.getValue("location");

                // var unitsLinesCount = currentRecord.getLineCount({
                // 	sublistId: "item",
                // });
                try {
                    // console.log("unitsLinesCount", unitsLinesCount);
                    // if (unitsLinesCount > 0) {
                    // 	for (var i = 0; i < unitsLinesCount; i++) {
                    // 		var line = currentRecord.selectLine({
                    // 			sublistId: "item",
                    // 			line: i,
                    // 		});
                    var amountLine = currentRecord.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "amount",
                    });
                    var periodLine = currentRecord.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                    });
                    var locationLine = currentRecord.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "location",
                    });

                    // console.log("Amount " + i + " => " + amountLine);
                    // console.log("Quantity " + i + " => " + periodLine);
                    var newRate;
                    if (cycle === "1") {
                        // Daily
                        newRate = parseFloat(amountLine) / parseInt(periodLine);
                        var totalNewRate = newRate * parseInt(periodLine);
                        var formattedtotalNewRate = format.format({
                            value: totalNewRate,
                            type: format.Type.CURRENCY,
                        });
                    } else if (cycle === "2") {
                        // Monthly
                        newRate = parseFloat(amountLine) / parseInt(periodLine);
                        var newMonthRate = newRate / 30;
                        var formattedNewRate = format.format({
                            value: newRate,
                            type: format.Type.CURRENCY,
                        });
                        var totalNewRate = newRate * 30 * parseInt(periodLine);
                        var formattedtotalNewRate = format.format({
                            value: totalNewRate,
                            type: format.Type.CURRENCY,
                        });
                    }
                    // console.log("New Rate " + i + " => " + newRate);
                    // newRes.commitLine("item");

                    // Update Contract Lines
                    // var contractline = contractRecord.selectLine({
                    //   sublistId: "item",
                    //   line: i,
                    // });
                    currentRecord.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: newRate,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true,
                    });
                    // console.log("Line Rate: ", newRate);
                    // console.log("Line Location: ", locationLine);
                    // console.log("Current Location: ", currentLocation);
                    // console.log("Line Amount: ", amountLine);
                    var rateLine = currentRecord.getCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                    });
                    // console.log("Get Line Rate: ", rateLine);
                    // currentRecord.setCurrentSublistValue({
                    // 	sublistId: "item",
                    // 	fieldId: "amount",
                    // 	value: formattedtotalNewRate,
                    // 	ignoreFieldChange: false,
                    // 	forceSyncSourcing: true,
                    // });
                    if (locationLine != currentLocation) {
                        currentRecord.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "location",
                            value: currentLocation,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true,
                        });
                    }
                    currentRecord.commitLine("item");

                    // console.log(
                    //   "New Rate After Change " + i + " => " + rateAfterChange
                    // );
                    // }
                    // }
                } catch (error) {
                    console.log("ERROR " + error);
                }
            }

            // Commision
            if (fieldName === "custbody_ns_sales_person") {
                var reservationComission = currentRecord.getValue(
                    "custbody_ns_sales_person"
                );
                console.log("Commission Changed");
                var commissionPercentField = currentRecord.getField({
                    fieldId: "custbody_ns_commission_percent",
                });
                var commissionAmountField = currentRecord.getField({
                    fieldId: "custbody_ns_commission_amount",
                });
                if (reservationComission) {
                    commissionPercentField.isDisabled = false;
                    commissionAmountField.isDisabled = false;
                } else {
                    commissionPercentField.isDisabled = true;
                    commissionAmountField.isDisabled = true;
                }
                // Booking.com
                if (reservationComission == 6) {
                    console.log("Commision to Booking.com");
                }
                // Auto-set 9% commission for sales person 14
                if (reservationComission == 14) {
                    currentRecord.setValue("custbody_ns_commission_percent", 9);
                    currentRecord.setValue("custbody_ns_commission_amount", "");
                }
            }
            if (fieldName === "custbody_ns_commission_percent") {
                currentRecord.setValue("custbody_ns_commission_amount", "");
            }
            if (fieldName === "custbody_ns_commission_amount") {
                currentRecord.setValue("custbody_ns_commission_percent", "");
            }

            // ============== When Unit Type Filter Changed ==============
            // Re-populate the available-units sublist restricted to the chosen type
            // (blank = all types), then re-run the suggestion engine.
            if (fieldName === UNIT_TYPE_FILTER_FIELD) {
                try {
                    var fBuilding = currentRecord.getValue({ fieldId: "location" });
                    if (fBuilding) {
                        var fStart = currentRecord.getValue({ fieldId: "startdate" });
                        var fEnd = currentRecord.getValue({ fieldId: "enddate" });
                        var fStartStr = DateToString(new Date(fStart));
                        var fEndStr = DateToString(new Date(fEnd));

                        var fAll = searchAllUnits(fBuilding);
                        var fOcc = searchOccuipedUnits(fBuilding, fStartStr, fEndStr);
                        var fVacant = fAll.filter(function (v) {
                            return !fOcc.includes(v.id);
                        });
                        fVacant = applyTypeFilter(currentRecord, fVacant);

                        // Clear the sublist, then repopulate with the filtered set.
                        var fLines = currentRecord.getLineCount({
                            sublistId: "custpage_availbale_units",
                        });
                        for (var fi = fLines; fi > 0; fi--) {
                            currentRecord.removeLine({
                                sublistId: "custpage_availbale_units",
                                line: fi - 1,
                                ignoreRecalc: true,
                            });
                        }
                        for (var fj = 0; fj < fVacant.length; fj++) {
                            currentRecord.selectNewLine("custpage_availbale_units");
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_id",
                                fVacant[fj].id
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_list",
                                fVacant[fj].name
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_status",
                                fVacant[fj].status
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_type",
                                fVacant[fj].type
                            );
                            currentRecord.setCurrentSublistValue(
                                "custpage_availbale_units",
                                "custpage_units_building",
                                fVacant[fj].building
                            );
                            currentRecord.commitLine("custpage_availbale_units");
                        }
                        highlightRecommendedUnit(
                            currentRecord,
                            fBuilding,
                            fStart,
                            fEnd,
                            currentRecord.id
                        );
                    }
                } catch (e) {
                    console.log("Unit type filter ERROR: ", e);
                }
            }

            flag = "manual"; //added by User
        }
    }

    /* ==================================================================
     *  SMART UNIT SUGGESTION ENGINE  (deterministic — no LLM / no API)
     *
     *  Goal: among the units that are AVAILABLE for [S, E], rank them so the
     *  BEST one to book bubbles to the top, in order to maximise long-term
     *  occupancy and minimise un-fillable ("frozen") inventory gaps.
     *
     *  LOWER score = BETTER. The winner is the minimum score.
     * ================================================================== */

    var SUGGEST_UNIT_SUBLIST_ID = "custpage_availbale_units";

    var MIN_STAY = 5; // Khareef-market minimum bookable nights; a gap smaller than this is un-fillable
    var DEAD_GAP_PENALTY = 1000; // near-disqualifying: a frozen gap that can never be sold
    var CONSOLIDATION_BONUS = 50; // reward routing bookings into units already carrying reservations
    var SANDWICH_PENALTY = 200; // both sides boxed in = rigid, no room for extensions
    var OPEN_ENDED_COST = 20; // mild cost for leaving a side (and often a whole unit) under-used

    var ONE_DAY_MS = 1000 * 60 * 60 * 24;

    function daysBetween(from, to) {
        // Whole days between two Date objects (to - from), calendar-safe rounding.
        return Math.round((to.getTime() - from.getTime()) / ONE_DAY_MS);
    }

    function parseNsDate(value) {
        if (!value) return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        try {
            var d = format.parse({ value: value, type: format.Type.DATE });
            return d && !isNaN(d.getTime()) ? d : null;
        } catch (e) {
            return null;
        }
    }

    // gap === 0  -> perfect back-to-back turnover
    // 0 < gap < MIN_STAY -> frozen inventory (can never be re-sold)
    // gap >= MIN_STAY    -> fillable, cost proportional to its size
    function scoreGap(gap, isOpenEnded) {
        if (isOpenEnded) return OPEN_ENDED_COST;
        if (gap === 0) return 0;
        if (gap < MIN_STAY) return DEAD_GAP_PENALTY + (MIN_STAY - gap) * 50;
        return gap * 2;
    }

    function scoreUnit(u) {
        var s = scoreGap(u.gapBefore, u.noPrev) + scoreGap(u.gapAfter, u.noNext);
        if (!u.noPrev && !u.noNext) s += SANDWICH_PENALTY; // rigid sandwich
        if (u.existingRes > 0) s -= CONSOLIDATION_BONUS; // consolidate; keep other units fully empty for long stays
        return s;
    }

    // Ranking comparator. Primary key = score (asc). When two units tie on
    // score we prefer the one with a FREE next side (room to extend the booking
    // forward); a unit boxed by a future reservation is less flexible. This is
    // what breaks the Unit3 vs Unit2 tie in the worked example below.
    function compareUnits(a, b) {
        if (a.score !== b.score) return a.score - b.score;
        var aBoxedNext = a.noNext ? 0 : 1;
        var bBoxedNext = b.noNext ? 0 : 1;
        if (aBoxedNext !== bBoxedNext) return aBoxedNext - bBoxedNext;
        // Then prefer the tighter total fit (fewer wasted gap-days).
        var aGap = (a.noPrev ? 0 : a.gapBefore) + (a.noNext ? 0 : a.gapAfter);
        var bGap = (b.noPrev ? 0 : b.gapBefore) + (b.noNext ? 0 : b.gapAfter);
        if (aGap !== bGap) return aGap - bGap;
        return a.line - b.line; // stable
    }

    // For a unit, find its tightest neighbours around the requested [S, E].
    //  - prevEnd   = end date of the nearest reservation ENDING on/before S
    //  - nextStart = start date of the nearest reservation STARTING on/after E
    //  - existingRes = count of that unit's active (non-excluded) reservations
    function computeUnitNeighbors(unitId, reservations, S, E) {
        var prevEnd = null;
        var nextStart = null;
        var existingRes = 0;
        for (var i = 0; i < reservations.length; i++) {
            var r = reservations[i];
            if (String(r.unitId) !== String(unitId)) continue;
            existingRes++;
            if (r.end && r.end.getTime() <= S.getTime()) {
                if (!prevEnd || r.end.getTime() > prevEnd.getTime()) prevEnd = r.end;
            }
            if (r.start && r.start.getTime() >= E.getTime()) {
                if (!nextStart || r.start.getTime() < nextStart.getTime())
                    nextStart = r.start;
            }
        }
        var noPrev = !prevEnd;
        var noNext = !nextStart;
        return {
            noPrev: noPrev,
            noNext: noNext,
            existingRes: existingRes,
            gapBefore: noPrev ? null : daysBetween(prevEnd, S),
            gapAfter: noNext ? null : daysBetween(E, nextStart),
        };
    }

    // Arabic-correct night count for gaps (gap is always 1..MIN_STAY-1 here).
    function nightsAr(n) {
        if (n === 1) return "ليلة واحدة";
        if (n === 2) return "ليلتين";
        return n + " ليالٍ";
    }

    // Short, human-readable (Arabic) justification for a unit, composed from
    // whichever conditions actually applied.
    function buildReason(u) {
        var parts = [];
        if (!u.noPrev && u.gapBefore === 0)
            parts.push("متتالية مع حجز سابق — بدون ليالٍ ضائعة");
        if (!u.noNext && u.gapAfter === 0)
            parts.push("متتالية مع حجز لاحق — بدون ليالٍ ضائعة");
        if (u.existingRes > 0)
            parts.push("تُبقي الشقق الأخرى فارغة تماماً لحجوزات الخريف الطويلة");
        if (u.noPrev && u.noNext)
            parts.push("شقة فارغة — يُفضّل حجزها لفترة أطول");
        if (!u.noPrev && !u.noNext)
            parts.push("محصورة بين حجزين — غير مرنة، لا مجال للتمديد");
        if (!u.noPrev && u.gapBefore > 0 && u.gapBefore < MIN_STAY)
            parts.push("تترك فجوة " + nightsAr(u.gapBefore) + " لا يمكن إعادة حجزها");
        if (!u.noNext && u.gapAfter > 0 && u.gapAfter < MIN_STAY)
            parts.push("تترك فجوة " + nightsAr(u.gapAfter) + " لا يمكن إعادة حجزها");
        if (!parts.length) parts.push("خيار مناسب لهذه الفترة");
        return parts.join("؛ ");
    }

    /* ------------------------------------------------------------------
     *  WORKED EXAMPLE (verifiable assertion of the ranking logic).
     *  Request 03/07 -> 10/07, four 2-bedroom units:
     *    Unit1 booked 28/06->02/07 => gapBefore=1 (<MIN_STAY) => DEAD, reject
     *    Unit2 booked 10/07->15/07 => gapAfter=0 but future-sandwiched side
     *    Unit3 booked 01/07->03/07 => gapBefore=0 perfect, open after => WINNER
     *    Unit4 no July bookings    => open both sides, wastes a clean unit
     *  Expected ranking: Unit3 (best) -> Unit2 -> Unit4 -> Unit1 (worst).
     *
     *  Scores (lower = better):
     *    Unit1: scoreGap(1,false)=1000+(5-1)*50=1200 ; +open-after 20 ; -50 consol = 1170
     *    Unit2: open-before 20 ; +gapAfter(0)=0 ; -50 consol            = -30
     *    Unit3: gapBefore(0)=0 ; +open-after 20 ; -50 consol            = -30
     *    Unit4: open 20 + open 20 ; no consol                           =  40
     *  Unit2 and Unit3 tie at -30; the comparator's "free next side" rule
     *  puts Unit3 (open after) ahead of Unit2 (boxed by a future stay).
     *  Run __selfTestSuggestionEngine() in the browser console to verify.
     * ------------------------------------------------------------------ */
    function __selfTestSuggestionEngine() {
        var units = [
            { name: "Unit1", noPrev: false, gapBefore: 1, noNext: true, gapAfter: null, existingRes: 1, line: 0 },
            { name: "Unit2", noPrev: true, gapBefore: null, noNext: false, gapAfter: 0, existingRes: 1, line: 1 },
            { name: "Unit3", noPrev: false, gapBefore: 0, noNext: true, gapAfter: null, existingRes: 1, line: 2 },
            { name: "Unit4", noPrev: true, gapBefore: null, noNext: true, gapAfter: null, existingRes: 0, line: 3 },
        ];
        units.forEach(function (u) { u.score = scoreUnit(u); });
        units.sort(compareUnits);
        var order = units.map(function (u) { return u.name; }).join(" -> ");
        var expected = "Unit3 -> Unit2 -> Unit4 -> Unit1";
        var pass = order === expected;
        console.log("[SuggestionEngine self-test]", pass ? "PASS" : "FAIL", "|", order);
        if (!pass) console.error("Expected:", expected);
        return pass;
    }

    // Only the NEAREST reservation ending on/before S and the nearest starting
    // on/after E matter for gap scoring, so we fetch a bounded window around
    // [S, E] instead of the building's entire reservation history. This keeps the
    // client-side search tiny and stops it from freezing the UI. Reservations
    // further away than NEIGHBOR_WINDOW_DAYS are irrelevant to occupancy gaps
    // (the unit reads as effectively open on that side).
    var NEIGHBOR_WINDOW_DAYS = 400; // ~13 months — tune if needed

    function searchBuildingReservations(building, S, E, excludeResId) {
        var reservations = [];
        try {
            var prevFromStr = DateToString(
                new Date(S.getTime() - NEIGHBOR_WINDOW_DAYS * ONE_DAY_MS)
            );
            var nextToStr = DateToString(
                new Date(E.getTime() + NEIGHBOR_WINDOW_DAYS * ONE_DAY_MS)
            );
            var Sstr = DateToString(S);
            var Estr = DateToString(E);
            search
                .create({
                    type: "customsale_ns_reservations",
                    title: "Building Reservations for Suggestion Engine",
                    columns: ["internalid", "status", "startdate", "enddate", "item"],
                    filters: [
                        ["location", "is", building],
                        "AND",
                        ["account", "is", "1388"],
                        "AND",
                        [
                            // prev-neighbour candidates: end within [S - window, S]
                            [
                                ["enddate", "onorbefore", Sstr],
                                "AND",
                                ["enddate", "onorafter", prevFromStr],
                            ],
                            "OR",
                            // next-neighbour candidates: start within [E, E + window]
                            [
                                ["startdate", "onorafter", Estr],
                                "AND",
                                ["startdate", "onorbefore", nextToStr],
                            ],
                        ],
                    ],
                })
                .run()
                .each(function (result) {
                    var internalId = result.getValue({ name: "internalid" });
                    if (excludeResId && String(internalId) === String(excludeResId)) return true;
                    var resStatus = result.getValue({ name: "status" });
                    var statusCode = String(resStatus || "").slice(-1).toUpperCase();
                    if (statusCode !== "A" && statusCode !== "B") return true;
                    var unitId = result.getValue({ name: "item" });
                    if (!unitId) return true;
                    reservations.push({
                        unitId: unitId,
                        start: parseNsDate(result.getValue({ name: "startdate" })),
                        end: parseNsDate(result.getValue({ name: "enddate" })),
                    });
                    return true;
                });
        } catch (e) {
            console.log("searchBuildingReservations ERROR: ", e);
        }
        return reservations;
    }

    var MAX_RECOMMENDED = 2; // ✅ Recommended badges to show, besides the single Best
    var MAX_AVOID = 2; // ⚠️ Avoid badges to show

    // Assign a capped tier badge (written to each unit's .badge) so only the most
    // useful signals are surfaced — the rest of the rows stay blank:
    //  ⭐ #1 Best         -> the single best-scoring bookable unit
    //  ✅ #n Recommended  -> the next MAX_RECOMMENDED bookable units
    //  ⚠️ Avoid          -> the worst MAX_AVOID units carrying a frozen dead gap
    // `scored` must already be sorted best-first (ascending score).
    function assignTiers(scored) {
        var bookable = [];
        var dead = [];
        for (var i = 0; i < scored.length; i++) {
            scored[i].badge = "";
            if (scored[i].score >= DEAD_GAP_PENALTY) dead.push(scored[i]);
            else bookable.push(scored[i]);
        }
        // Best + up to MAX_RECOMMENDED alternatives.
        for (var b = 0; b < bookable.length && b <= MAX_RECOMMENDED; b++) {
            bookable[b].badge =
                b === 0 ? "⭐ #1 Best" : "✅ #" + (b + 1) + " Recommended";
        }
        // Worst up to MAX_AVOID dead-gap units (highest scores = worst).
        var avoidCount = Math.min(MAX_AVOID, dead.length);
        for (var d = 0; d < avoidCount; d++) {
            dead[dead.length - 1 - d].badge = "⚠️ Avoid";
        }
    }

    // Best-effort row tint keyed to the tier. NetSuite sublist row styling is
    // limited and DOM ids differ by render mode, so this is wrapped defensively;
    // the tier badge + note columns remain the reliable signal.
    function rowColorForTier(badge) {
        if (badge.indexOf("Avoid") !== -1) return "#fff5f5"; // faint red
        if (badge.indexOf("Best") !== -1) return "#e6ffed"; // green
        if (badge.indexOf("Recommended") !== -1) return "#f1fff5"; // pale green
        return ""; // options: no tint
    }
    function setRowColor(line, color) {
        try {
            if (typeof document === "undefined") return;
            var ids = [
                SUGGEST_UNIT_SUBLIST_ID + "row" + line,
                SUGGEST_UNIT_SUBLIST_ID + "row_" + line,
            ];
            for (var i = 0; i < ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if (el) {
                    el.style.backgroundColor = color;
                    return;
                }
            }
        } catch (e) { /* non-fatal */ }
    }

    // Score every unit shown in the available-units sublist, rank them, and write
    // a tier badge + a per-line justification note onto each line. Surfaces
    // several ranked choices. Does NOT auto-select any unit — it only suggests.
    function highlightRecommendedUnit(rec, building, startVal, endVal, excludeResId) {
        try {
            if (!building) return;
            var S = parseNsDate(startVal);
            var E = parseNsDate(endVal);
            if (!S || !E) return;

            var lineCount = rec.getLineCount({ sublistId: SUGGEST_UNIT_SUBLIST_ID });
            if (!lineCount || lineCount < 1) return;

            var lines = [];
            for (var i = 0; i < lineCount; i++) {
                lines.push({
                    line: i,
                    id: rec.getSublistValue({
                        sublistId: SUGGEST_UNIT_SUBLIST_ID,
                        fieldId: "custpage_units_id",
                        line: i,
                    }),
                    name: rec.getSublistValue({
                        sublistId: SUGGEST_UNIT_SUBLIST_ID,
                        fieldId: "custpage_units_list",
                        line: i,
                    }),
                });
            }

            var reservations = searchBuildingReservations(building, S, E, excludeResId);

            var scored = lines.map(function (l) {
                var u = computeUnitNeighbors(l.id, reservations, S, E);
                u.line = l.line;
                u.id = l.id;
                u.name = l.name;
                u.score = scoreUnit(u);
                u.reason = buildReason(u);
                return u;
            });
            scored.sort(compareUnits);
            assignTiers(scored);

            // Only ~5 lines ever get a badge (1 Best + up to 2 Recommended + up to 2
            // Avoid). The populate step already created every line blank, so we skip
            // the unbadged lines entirely — each committed line re-renders the
            // inline-editor sublist, which is the slowest client-side operation, so
            // touching 5 lines instead of all N is the main UI-unblocking win here.
            for (var j = 0; j < scored.length; j++) {
                var badge = scored[j].badge;
                if (!badge) continue;
                rec.selectLine({ sublistId: SUGGEST_UNIT_SUBLIST_ID, line: scored[j].line });
                rec.setCurrentSublistValue({
                    sublistId: SUGGEST_UNIT_SUBLIST_ID,
                    fieldId: "custpage_units_recommended",
                    value: badge,
                    ignoreFieldChange: true,
                });
                rec.setCurrentSublistValue({
                    sublistId: SUGGEST_UNIT_SUBLIST_ID,
                    fieldId: "custpage_units_suggest_note",
                    value: scored[j].reason,
                    ignoreFieldChange: true,
                });
                rec.commitLine({ sublistId: SUGGEST_UNIT_SUBLIST_ID });
                setRowColor(scored[j].line, rowColorForTier(badge));
            }
        } catch (e) {
            console.log("highlightRecommendedUnit ERROR: ", e);
        }
    }

    /* ==================================================================
     *  UNIT TYPE FILTER  (interactive dropdown above the sublist)
     * ================================================================== */
    var UNIT_TYPE_FILTER_FIELD = "custpage_units_type_filter";
    // Option values we injected last time, so we can clear them before rebuilding.
    var unitTypeFilterValues = [];

    // Rebuild the dropdown's options from the distinct unit types currently in
    // the building. Preserves the user's current selection when still valid.
    function refreshUnitTypeFilterOptions(rec, units) {
        try {
            var field = rec.getField({ fieldId: UNIT_TYPE_FILTER_FIELD });
            if (!field) return;
            var selected = rec.getValue({ fieldId: UNIT_TYPE_FILTER_FIELD });
            // Remove previously-added options (leave the native blank = "all types").
            for (var i = 0; i < unitTypeFilterValues.length; i++) {
                try {
                    field.removeSelectOption({ value: unitTypeFilterValues[i] });
                } catch (e) { /* option may already be gone */ }
            }
            unitTypeFilterValues = [];
            var seen = {};
            var types = [];
            for (var j = 0; j < units.length; j++) {
                var t = units[j].type;
                if (t && !seen[t]) {
                    seen[t] = true;
                    types.push(t);
                }
            }
            types.sort();
            for (var k = 0; k < types.length; k++) {
                field.insertSelectOption({ value: types[k], text: types[k] });
                unitTypeFilterValues.push(types[k]);
            }
            // Restore the prior selection if that type still exists.
            if (selected && seen[selected]) {
                rec.setValue({
                    fieldId: UNIT_TYPE_FILTER_FIELD,
                    value: selected,
                    ignoreFieldChange: true,
                });
            }
        } catch (e) {
            console.log("refreshUnitTypeFilterOptions ERROR: ", e);
        }
    }

    // Narrow a unit list to the selected type (blank selection = all types).
    function applyTypeFilter(rec, list) {
        try {
            var selected = rec.getValue({ fieldId: UNIT_TYPE_FILTER_FIELD });
            if (!selected) return list;
            return list.filter(function (u) {
                return String(u.type) === String(selected);
            });
        } catch (e) {
            return list;
        }
    }

    function searchAllUnits(building) {
        console.log("searchAllUnits: Location ", building);
        var allUnits = [];
        try {
            var unitsSearch = search.create({
                type: search.Type.ITEM,
                title: "Search All Units in Building",
                columns: [
                    "internalid",
                    "itemid",
                    "custitem_ns_property_status",
                    "custitem_ns_item_unit_type",
                    "location",
                ],
                filters: [["location", "is", building]],
            });
            unitsSearch.run().each(function (result) {
                // Process each result
                var internalId = result.getValue({
                    name: "internalid",
                });
                var unitName = result.getValue({
                    name: "itemid",
                });
                var unitStatus = result.getText({
                    name: "custitem_ns_property_status",
                });
                // Unit type — prefer the label (list/record field); fall back to the
                // raw value if it's a free-text field.
                var unitType =
                    result.getText({ name: "custitem_ns_item_unit_type" }) ||
                    result.getValue({ name: "custitem_ns_item_unit_type" }) ||
                    "";
                var unitBuilding = result.getText({
                    name: "location",
                });
                // log.debug(
                //   "Units Search",
                //   " Id: " +
                //     internalId +
                //     " Status : " +
                //     unitStatus +
                //     " Build : " +
                //     unitBuilding
                // );
                allUnits.push({
                    id: internalId,
                    name: unitName,
                    status: unitStatus,
                    type: unitType,
                    building: unitBuilding,
                });
                return true;
            });
        } catch (error) {
            console.log("searchAllUnits ERROR: ", error);
        }

        return allUnits;
    }
    function searchOccuipedUnits(building, start, end) {
        var occupiedUnits = [];
        var reservationsSearch = search
            .create({
                type: "customsale_ns_reservations",
                title: "Search Units Without Reservation",
                columns: [
                    "tranid",
                    "status",
                    "location",
                    "startdate",
                    "enddate",
                    "item",
                ],
                filters: [
                    ["location", "is", building],
                    "AND",
                    ["account", "is", "1388"],
                    "AND",
                    ["startdate", "before", end],
                    "AND",
                    ["enddate", "after", start],
                ],
            })
            .run()
            .each(function (result) {
                // Process each result
                var internalId = result.getValue({
                    name: "tranid",
                });
                var resStatus = result.getValue({
                    name: "status",
                });
                var resBuilding = result.getValue({
                    name: "location",
                });
                var resStart = result.getValue({
                    name: "startdate",
                });
                var resEnd = result.getValue({
                    name: "enddate",
                });
                var resItem = result.getValue({
                    name: "item",
                });
                // log.debug(
                //   "Reservation Search",
                //   " Id: " +
                //     internalId +
                //     " Status : " +
                //     resStatus +
                //     " Build : " +
                //     resBuilding +
                //     " From " +
                //     resStart +
                //     " => " +
                //     resEnd +
                //     " Unit = " +
                //     resItem
                // );

                // console.log("OCCUPIED UNIT", {
                // 	internalId: internalId,
                // 	resStatus: resStatus,
                // 	resBuilding: resBuilding,
                // 	resStart: resStart,
                // 	resEnd: resEnd,
                // 	resItem: resItem,
                // });
                // The "status" search column does NOT return "statusA"/"statusB" for this
                // custom transaction — it returns the status code (e.g. "A", "B", or a
                // "<type>:A" form), so the old equality check was always false and no
                // conflict was ever detected. Match on the trailing code instead:
                // a unit is occupied by any overlapping reservation that is still active,
                // i.e. Pending Check-In ("A") or Checked-In ("B").
                var statusCode = String(resStatus || "").slice(-1).toUpperCase();
                console.log(
                    "Overlap candidate: res " + internalId + " | unit " + resItem +
                    " | status '" + resStatus + "' (code " + statusCode + ")"
                );
                if (statusCode === "A" || statusCode === "B") {
                    occupiedUnits.push(resItem);
                }
                return true;
            });
        return occupiedUnits;
    }

    function signFunc(reservationId) {
        // console.log("cuctomer Signature Clicked");
        try {
            //Load Reservation Transaction Record
            var reservationRecord = record.load({
                type: "customsale_ns_reservations",
                id: reservationId,
            });
            var recordUrl = url.resolveRecord({
                recordType: "customsale_ns_reservations",
                recordId: reservationId,
                isEditMode: false,
            });
            //alert("SignFunc " + recordUrl);
            var output = url.resolveScript({
                scriptId: "customscript_ogg_slt_sigplus",
                deploymentId: "customdeploy_ogg_slt_sigplus",
            });
            output =
                output +
                "&recordid=" +
                reservationId +
                "&type=customsale_ns_reservations" +
                "&recordurl=" +
                recordUrl +
                "&displaymode=view";
            window.open(output, "_self");
        } catch (e) {
            alert(e);
            log.debug("ERROR", "signFunc | error", JSON.stringify(e));
        }
    }
    function createJournalEntry(contractsIds) {
        try {
            console.log("Test Button Clicked");
            var output = url.resolveScript({
                scriptId: "customscript_ns_slt_start_sch_script",
                deploymentId: "customdeploy_ns_slt_start_sch_script",
            });
            output = output + "&transactions=" + contractsIds + "&type=contract";

            console.log("url", output);

            var response = https.get({
                url: output,
            });

            console.log("response", response);
        } catch (e) {
            alert(e);
            log.debug("ERROR", "createJournalEntry | error", JSON.stringify(e));
        }
    }

    // Collect the internal ids of every contract created from this reservation.
    // Mirrors the filter used elsewhere (createdfrom OR custbody_ns_reseravtion_created)
    // so both direct and re-linked contracts are picked up.
    function getReservationContractIds(reservationId) {
        var contractIds = [];
        search
            .create({
                type: "customsale_ns_contracts",
                columns: ["internalid"],
                filters: [
                    ["createdfrom", "is", reservationId],
                    "or",
                    ["custbody_ns_reseravtion_created", "is", reservationId],
                ],
            })
            .run()
            .each(function (result) {
                if (result.id) {
                    contractIds.push(result.id);
                }
                return true;
            });
        return contractIds;
    }

    // Button handler: (re)build the 85%/15% contract journal for this
    // reservation's contracts. createJournalEntry expects a comma-separated list
    // of contract internal ids, so gather them first.
    function createContractJournalFromReservation(reservationId) {
        try {
            var contractIds = getReservationContractIds(reservationId);
            if (contractIds.length === 0) {
                alert(
                    "لا يوجد عقود مرتبطة بهذا الحجز.\n" +
                    "No contracts found for this reservation."
                );
                return;
            }
            var contractsString = contractIds.join(",");
            console.log("Creating Journals for contracts: ", contractsString);
            createJournalEntry(contractsString);
            alert(
                "تم إرسال طلب إنشاء القيد للعقود: " + contractsString + "\n" +
                "Journal creation triggered for contracts: " + contractsString
            );
        } catch (e) {
            alert(e);
            log.debug(
                "ERROR",
                "createContractJournalFromReservation | error",
                JSON.stringify(e)
            );
        }
    }

    function createCommissionJournalEntry(resId) {
        try {
            console.log("Create Commission Journal Entry Clicked");
            console.log("Reservation ID: ", resId);

            var output = url.resolveScript({
                scriptId: "customscript_ns_slt_start_sch_script",
                deploymentId: "customdeploy_ns_slt_start_sch_script",
            });
            output = output + "&reservation=" + resId;

            console.log("url", output);

            var response = https.get({
                url: output,
            });

            console.log("response", response);
        } catch (e) {
            alert(e);
            log.debug("ERROR", "createJournalEntry | error", JSON.stringify(e));
        }
    }

    function saveRecord(context) {
        try {
            var userRole = runtime.getCurrentUser().role;
            console.log("User Role", userRole);
            // if (userRole == "3") {
            var currentRecord = context.currentRecord;
            console.log("Update Reservation Begin ...");

            // ===== Booking.com requires a commission value =====
            // When Booking.com (id 6) is the sales person, the user must enter
            // either a commission percent or a commission amount, otherwise block save.
            var salesPerson = currentRecord.getValue("custbody_ns_sales_person");
            if (salesPerson == 6) {
                var commissionPercent = currentRecord.getValue(
                    "custbody_ns_commission_percent"
                );
                var commissionAmount = currentRecord.getValue(
                    "custbody_ns_commission_amount"
                );
                if (!commissionPercent && !commissionAmount) {
                    alert(
                        "عند إختيار Booking.com يجب إدخال نسبة العمولة أو قيمة العمولة." +
                        "\n" +
                        "When Booking.com is selected, you must enter a commission percentage or a commission amount."
                    );
                    return false;
                }
            }

            var main_location = currentRecord.getValue({
                fieldId: "location",
            });
            console.log("Location: " + main_location);
            var numLines = currentRecord.getLineCount({
                sublistId: "item",
            });
            console.log("Line Count: " + numLines);

            for (var i = 0; i < numLines; i++) {
                var sublistUnitValue = currentRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "item",
                    line: i,
                });
                var sublistUnitValue = currentRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "location",
                    line: i,
                });
                console.log(
                    "Unit: " + sublistUnitValue + " Location: " + sublistUnitValue
                );
                if (sublistUnitValue != main_location) {
                    currentRecord.selectLine({
                        sublistId: "item",
                        line: i,
                    });
                    currentRecord.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "location",
                        value: main_location,
                        ignoreFieldChange: true,
                    });
                    currentRecord.commitLine({
                        sublistId: "item",
                    });
                }
            }
            // }
            return true;
        } catch (error) {
            console.log("saveRecord ERROR", error);
        }
        return true;
    }


    /**
   * Electricity Reading Dialog for Reservation Utility Tracking
   * @param {string} resId - Reservation Internal ID
   */
    function openElectricitySuitelet() {
        try {
            var record = currentRecord.get();
            var resId = record.id;

            // Generate Suitelet URL
            var suiteletURL = url.resolveScript({
                scriptId: 'customscript_ns_slt_electricity_water_re', // Replace with your Suitelet ID
                deploymentId: 'customdeploy_ns_slt_electricity_water_re', // Replace with your Deployment ID
                params: {
                    'resid': resId,
                }
            });

            console.log('Opening Suitelet URL:', suiteletURL);

            // Open in new window
            window.open(suiteletURL, '_blank', 'width=1000,height=800,scrollbars=yes,resizable=yes');

        } catch (error) {
            console.error('Error opening Suitelet:', error);
            dialog.alert({
                title: 'Error',
                message: 'Failed to open electricity reading form: ' + error.message
            });
        }
    }
    function waterReading(resId) {
        try {
            console.log("Reading Water: ", resId);

        } catch (error) {
            console.error("waterReading ERROR", error)
        }
    }


    function showPaymentLinkDialog() {
        var current = currentRecord.get();

        if (!current.id) {
            dialog.alert({
                title: "Save first",
                message: "Please save the reservation before creating a payment link.",
            });
            return;
        }

        // Step 1 — ask for amount
        var raw = window.prompt("Enter the amount to charge the customer (OMR):", "");
        if (raw === null) return;
        var amount = parseFloat(String(raw).replace(",", "."));
        if (isNaN(amount) || amount <= 0) {
            dialog.alert({
                title: "Invalid amount",
                message: "Please enter a positive number, e.g. 40 or 12.500",
            });
            return;
        }

        // Optional note
        var description = window.prompt(
            "Add a short note for the customer (optional — press OK to skip):",
            ""
        );
        if (description === null) return;
        description = description ? String(description).trim() : "";

        // Load the persisted reservation from the server so we can read body fields
        // that aren't rendered on the form (currentRecord.get() only sees on-form fields).
        var rec;
        try {
            rec = record.load({
                type: current.type,
                id: current.id,
                isDynamic: false,
            });
        } catch (e) {
            dialog.alert({
                title: "Could not load reservation",
                message: "Failed to load reservation " + current.id + ": " + (e.message || String(e)),
            });
            return;
        }

        // Step 2 — collect reservation data from the loaded record (+ customer fallback)
        var payload;
        try {
            payload = buildPayload(rec, amount, description);
        } catch (e) {
            dialog.alert({ title: "Error", message: e.message || String(e) });
            return;
        }

        console.log("payload: ", payload)
        if (!payload.customerName) {
            dialog.alert({
                title: "Customer missing",
                message: "Could not resolve a customer name. Set the customer link or fill the customer-name field on the reservation.",
            });
            return;
        }

        // Step 3 — POST to website API directly
        fetch(WEBSITE_BASE_URL + "/api/netsuite/payment-link", {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "x-netsuite-secret": INBOUND_SECRET,
            },
            body: JSON.stringify(payload),
        })
            .then(function (resp) {
                return resp.text().then(function (text) {
                    var data;
                    try { data = JSON.parse(text); } catch (e) {
                        throw new Error("Website returned non-JSON (HTTP " + resp.status + "): " + text.slice(0, 200));
                    }
                    if (!resp.ok || !data.ok) {
                        throw new Error(data.error || ("HTTP " + resp.status));
                    }
                    return data;
                });
            })
            .then(function (data) {
                showLinkDialog(data.url, payload.customerPhone, data.reused, amount);
            })
            .catch(function (err) {
                var msg = err && err.message ? err.message : String(err);
                // CSP / network failures show as "Failed to fetch" — give the user a hint.
                if (/failed to fetch/i.test(msg)) {
                    msg += "\n\nIf this is a fresh deployment, ensure your NetSuite account has " +
                        new URL(WEBSITE_BASE_URL).hostname +
                        " on the Allowed Domain List (Setup → Company → Setup Tasks → Allowed Domain List).";
                }
                dialog.alert({ title: "Could not create link", message: msg });
            });
    }

    // ── Reservation data extraction ────────────────────────────────────────────

    function buildPayload(rec, amount, description) {
        var reservationRef = safeGet(rec, FIELD_IDS.reservationRef) || ("ID-" + rec.id);

        // Customer name: prefer linked customer, fall back to text field
        var customerName = "";
        var customerEntityId = safeGet(rec, FIELD_IDS.customerEntity);
        if (customerEntityId) {
            customerName = safeGetText(rec, FIELD_IDS.customerEntity) || "";
        }
        if (!customerName) {
            customerName = safeGet(rec, FIELD_IDS.customerNameTxt) || "";
        }

        var customerPhone = safeGet(rec, FIELD_IDS.customerPhone);
        var customerEmail = safeGet(rec, FIELD_IDS.customerEmail);

        // If linked customer, lookup the customer record for missing fields
        if (customerEntityId && (!customerPhone || !customerEmail || !customerName)) {
            try {
                var fields = search.lookupFields({
                    type: search.Type.CUSTOMER,
                    id: customerEntityId,
                    columns: ["companyname", "entityid", "phone", "email"],
                });
                if (!customerPhone) customerPhone = fields.phone || fields.phone || null;
                if (!customerEmail) customerEmail = fields.email || null;
                if (!customerName) customerName = fields.companyname || fields.entityid || "";
            } catch (e) {
                // Non-fatal — continue with whatever we already have
                console && console.warn && console.warn("Customer lookup failed:", e);
            }
        }

        var unitCode = safeGet(rec, FIELD_IDS.unitCode);
        var checkIn = isoDate(rec.getValue({ fieldId: FIELD_IDS.checkIn }));
        var checkOut = isoDate(rec.getValue({ fieldId: FIELD_IDS.checkOut }));
        var buildingId = safeGet(rec, FIELD_IDS.buildingId);
        var buildingName = safeGetText(rec, FIELD_IDS.buildingId);
        var recordDescription = safeGet(rec, FIELD_IDS.description);

        log.debug('Fields', {
            unitCode, checkIn, checkOut, buildingId, buildingName, recordDescription
        })

        var finalDescription = description || recordDescription || null;
        if (!finalDescription) {
            var bits = [];
            if (unitCode) bits.push("Unit " + unitCode);
            if (checkIn && checkOut) bits.push(checkIn + " → " + checkOut);
            if (bits.length) finalDescription = "Reservation: " + bits.join(" · ");
        }

        var user = runtime.getCurrentUser();

        return {
            netsuiteReservationId: String(rec.id),
            netsuiteReservationRef: reservationRef,
            unitCode: unitCode || null,
            buildingId: buildingId ? String(buildingId) : null,
            buildingName: buildingName || null,
            checkIn: checkIn,
            checkOut: checkOut,
            customerName: String(customerName).trim(),
            customerPhone: customerPhone ? String(customerPhone).trim() : null,
            customerEmail: customerEmail ? String(customerEmail).trim() : null,
            amount: Number(amount.toFixed(3)),
            currency: "OMR",
            description: finalDescription,
            receptionistEmail: user.email || null,
            receptionistName: user.name || null,
            locale: "en",
        };
    }

    function safeGet(rec, fieldId) {
        if (!fieldId) return null;
        try {
            var v = rec.getValue({ fieldId: fieldId });
            return v === "" || v === undefined || v === null ? null : v;
        } catch (e) {
            return null;
        }
    }

    function safeGetText(rec, fieldId) {
        if (!fieldId) return null;
        try {
            var v = rec.getText({ fieldId: fieldId });
            return v === "" || v === undefined || v === null ? null : v;
        } catch (e) {
            return null;
        }
    }

    function isoDate(d) {
        if (!d) return null;
        if (typeof d === "string") return d;
        try {
            var year = d.getFullYear();
            var month = String(d.getMonth() + 1).padStart(2, "0");
            var day = String(d.getDate()).padStart(2, "0");
            return year + "-" + month + "-" + day;
        } catch (e) {
            return null;
        }
    }

    // ── Result dialog ──────────────────────────────────────────────────────────

    function showLinkDialog(linkUrl, customerPhone, reused, amount) {
        copyToClipboard(linkUrl);

        var headerText = reused
            ? "An active link already exists for this reservation."
            : "Payment link created successfully.";

        var message =
            '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#333;">' +
            '<p style="margin:0 0 14px 0;color:#555;">' + escapeHtml(headerText) + '</p>' +
            '<div style="margin:0 0 16px 0;">' +
            '<span style="display:inline-block;padding:5px 12px;background:#eef5ff;border:1px solid #b6d4ff;border-radius:14px;color:#1a4a8a;font-weight:600;font-size:13px;">' +
            'Amount: ' + Number(amount).toFixed(3) + ' OMR' +
            '</span>' +
            '</div>' +
            '<div style="margin:0 0 6px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Payment link (copied to clipboard)</div>' +
            '<div style="padding:10px 12px;background:#f7f9fc;border:1px solid #dfe4ec;border-radius:6px;font-family:Menlo,Consolas,monospace;font-size:12px;color:#1a4a8a;word-break:break-all;">' +
            escapeHtml(linkUrl) +
            '</div>' +
            '</div>';

        var buttons = [
            { label: "Copy again", value: "copy" },
            { label: "Close", value: "close" },
        ];

        dialog.create({
            title: reused ? "Existing payment link" : "Payment link ready",
            message: message,
            buttons: buttons,
        }).then(function (action) {
            if (action === "copy") {
                copyToClipboard(linkUrl);
                dialog.alert({ title: "Copied", message: "Link copied to clipboard." });
            }
        });
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function copyToClipboard(text) {
        try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
                return;
            }
        } catch (e) { /* fall through */ }
        try {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        } catch (e) { /* nothing else we can do */ }
    }
    return {
        pageInit: pageInit,
        onButtonClick: onButtonClick,
        onCancelReservationClick: onCancelReservationClick,
        onRevertReservationClick: onRevertReservationClick,
        onCreateContractClick: onCreateContractClick,
        onCheckOutButtonClick: onCheckOutButtonClick,
        onCreditMemoButtonClick: onCreditMemoButtonClick,
        onPaymentClick: onPaymentClick,
        signFunc: signFunc,
        onAddUnits: onAddUnits,
        openElectricitySuitelet: openElectricitySuitelet,
        createCommissionJournalEntry: createCommissionJournalEntry,
        createContractJournalFromReservation: createContractJournalFromReservation,
        fieldChanged: fieldChanged,
        // sublistChanged: sublistChanged,
        saveRecord: saveRecord,
        postSourcing: postSourcing,
        showPaymentLinkDialog: showPaymentLinkDialog,
        // Exposed for verification: run in the browser console to assert the
        // worked-example ranking (Unit3 -> Unit2 -> Unit4 -> Unit1).
        __selfTestSuggestionEngine: __selfTestSuggestionEngine,
    };
});
