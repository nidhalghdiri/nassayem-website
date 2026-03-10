"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";

// Custom Nassayem Brand Pin
const nassayemIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: `
    <div style="background-color: #2a7475; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); cursor: pointer;">
      <div style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 14px; font-family: sans-serif;">N</div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -36], // Point from which the popup should open relative to the iconAnchor
});

// Mock locations for your buildings in Salalah
const locations = [
  {
    id: 1,
    nameEn: "North Awqad Building",
    nameAr: "بناية عوقد الشمالية",
    lat: 17.010115979009534,
    lng: 54.02225132697702,
    price: "450 OMR",
  },
  {
    id: 2,
    nameEn: "Salalah Center Building",
    nameAr: "بناية صلالة الوسطى",
    lat: 17.009866699681982,
    lng: 54.09308653697288,
    price: "35 OMR",
  },
  {
    id: 3,
    nameEn: "Hay Tijari Building",
    nameAr: "بناية الحي التجاري",
    lat: 17.023884257028893,
    lng: 54.09774645191348,
    price: "500 OMR",
  },
  {
    id: 4,
    nameEn: "Saadah Building",
    nameAr: "بناية السعادة",
    lat: 17.05598872757818,
    lng: 54.15406802168962,
    price: "500 OMR",
  },
];

export default function MapComponent({ locale }: { locale: string }) {
  const isEn = locale === "en";
  // Center coordinates of Salalah
  const salalahCenter: [number, number] = [17.025, 54.1];

  return (
    <MapContainer
      center={salalahCenter}
      zoom={12}
      scrollWheelZoom={false}
      className="w-full h-full rounded-3xl z-0"
    >
      {/* Clean, premium-looking map tiles (CartoDB Positron) */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {locations.map((loc) => (
        <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={nassayemIcon}>
          <Popup className="rounded-xl overflow-hidden">
            <div
              className="text-center p-1"
              style={{
                fontFamily: isEn ? "Inter, sans-serif" : "Tajawal, sans-serif",
              }}
            >
              <h3 className="font-bold text-gray-900 text-base mb-1">
                {isEn ? loc.nameEn : loc.nameAr}
              </h3>
              <p className="text-nassayem font-extrabold mb-2">{loc.price}</p>
              <Link
                href={`/${locale}/buildings/${loc.id}`}
                className="block bg-nassayem text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-nassayem-dark transition-colors"
              >
                {isEn ? "View Details" : "عرض التفاصيل"}
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
