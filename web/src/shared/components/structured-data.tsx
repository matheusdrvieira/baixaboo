type StructuredDataProps = {
  data: Record<string, unknown>;
};

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function createLegalPageStructuredData({
  frontendUrl,
  locale,
  language,
  homeName,
  path,
  name,
  description,
}: {
  frontendUrl: string;
  locale: string;
  language: string;
  homeName: string;
  path: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  const homeUrl = `${frontendUrl}/${locale}`;
  const pageUrl = `${homeUrl}/${path}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}/#webpage`,
        url: pageUrl,
        name,
        description,
        inLanguage: language,
        isPartOf: { "@id": `${frontendUrl}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: homeName,
            item: homeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
