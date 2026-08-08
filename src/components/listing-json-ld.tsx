/**
 * Schema.org VacationRental JSON-LD for marketplace listing pages.
 */
export function ListingJsonLd(props: {
  origin: string;
  name: string;
  description?: string | null;
  url: string;
  imageUrls: string[];
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  petsAllowed?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  priceNightly?: number;
  hostName?: string;
}) {
  const {
    origin,
    name,
    description,
    url,
    imageUrls,
    city,
    region,
    country,
    postalCode,
    latitude,
    longitude,
    guests,
    bedrooms,
    bathrooms,
    petsAllowed,
    checkInTime,
    checkOutTime,
    priceNightly,
    hostName,
  } = props;

  const data = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name,
    description: description || undefined,
    url,
    image: imageUrls.slice(0, 8),
    numberOfRooms: bedrooms,
    occupancy: guests
      ? { "@type": "QuantitativeValue", value: guests }
      : undefined,
    petsAllowed: petsAllowed ?? undefined,
    checkinTime: checkInTime || undefined,
    checkoutTime: checkOutTime || undefined,
    address:
      city || region || country
        ? {
            "@type": "PostalAddress",
            addressLocality: city || undefined,
            addressRegion: region || undefined,
            addressCountry: country || "US",
            postalCode: postalCode || undefined,
          }
        : undefined,
    geo:
      latitude != null && longitude != null
        ? {
            "@type": "GeoCoordinates",
            latitude,
            longitude,
          }
        : undefined,
    offers:
      priceNightly != null
        ? {
            "@type": "Offer",
            price: priceNightly,
            priceCurrency: "USD",
            unitText: "NIGHT",
            url,
            availability: "https://schema.org/InStock",
          }
        : undefined,
    brand: {
      "@type": "Brand",
      name: "Yall Come Back",
      url: origin,
    },
    provider: hostName
      ? { "@type": "Person", name: hostName }
      : undefined,
    additionalProperty:
      bathrooms != null
        ? [
            {
              "@type": "PropertyValue",
              name: "bathrooms",
              value: bathrooms,
            },
          ]
        : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
