import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export async function createSocialImage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [backgroundData, markData] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/baixaboo-social-background.jpg")),
    readFile(join(process.cwd(), "public/brand/baixaboo-mark.svg")),
  ]);
  const backgroundSrc = `data:image/jpeg;base64,${backgroundData.toString("base64")}`;
  const markSrc = `data:image/svg+xml;base64,${markData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0d0e1c",
        color: "white",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px 88px",
        position: "relative",
        width: "100%",
      }}
    >
      <img
        src={backgroundSrc}
        alt=""
        style={{ height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }}
      />
      <div
        style={{
          background:
            "linear-gradient(90deg, rgba(9, 10, 28, 0.96) 0%, rgba(9, 10, 28, 0.88) 43%, rgba(9, 10, 28, 0.15) 78%, rgba(9, 10, 28, 0.05) 100%)",
          display: "flex",
          height: "100%",
          left: 0,
          position: "absolute",
          top: 0,
          width: "100%",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", fontSize: 34, fontWeight: 700 }}>
          <img
            src={markSrc}
            alt=""
            style={{ borderRadius: 18, height: 72, marginRight: 22, width: 72 }}
          />
          Baixaboo
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-3px",
            lineHeight: 1.05,
            marginTop: 62,
            maxWidth: 760,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#d1cef6",
            display: "flex",
            fontSize: 27,
            marginTop: 30,
            maxWidth: 720,
          }}
        >
          {description}
        </div>
      </div>
    </div>,
    socialImageSize,
  );
}
