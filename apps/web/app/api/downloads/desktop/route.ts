import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const desktopArtifacts = ['XEEMS Setup 1.0.0.exe', 'XEEMS 1.0.0.exe'] as const;

function resolveDesktopArtifact() {
  const releaseDir = path.resolve(process.cwd(), '../desktop/release');

  for (const fileName of desktopArtifacts) {
    const artifactPath = path.join(releaseDir, fileName);
    if (fs.existsSync(artifactPath)) {
      return {
        artifactPath,
        fileName
      };
    }
  }

  return null;
}

export async function GET() {
  const artifact = resolveDesktopArtifact();
  if (!artifact) {
    return NextResponse.json({ error: 'Desktop download is not published on this server yet.' }, { status: 404 });
  }

  const file = await fs.promises.readFile(artifact.artifactPath);

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.microsoft.portable-executable',
      'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
      'Cache-Control': 'no-store'
    }
  });
}
