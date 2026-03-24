import { promises as fs } from "fs";
import path from "path";

const EDA_DIR = path.join(
  process.cwd(),
  "..",
  "mlpy",
  "output",
  "eda",
);

export async function GET(_request, { params }) {
  try {
    const fileName = path.basename(params.name);
    const filePath = path.join(EDA_DIR, fileName);
    const fileBuffer = await fs.readFile(filePath);
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
