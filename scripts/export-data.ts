import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createPackingExportGraph, PackingExportOptions } from '../src/lib/export';
import { parsePackingFile } from '../src/lib/parser';
import { DEFAULT_CRITICALITY_TOLERANCE } from '../src/lib/config';

async function main(): Promise<void> {
  const diskCount = Number(process.argv[2]);

  if (!Number.isInteger(diskCount) || diskCount < 1) {
    throw new Error('Usage: npm run export:data -- <disk-count>');
  }

  const sourcePath = path.join('data', `${diskCount}disks.json`);
  const sourceJSON = await readFile(sourcePath, 'utf8');
  const parsed = parsePackingFile(sourceJSON, path.basename(sourcePath));

  if (!parsed.data || parsed.errors.length > 0) {
    throw new Error(parsed.errors.join('\n') || `Could not parse ${sourcePath}`);
  }

  const options: PackingExportOptions = {
    includeStructure: true,
    includeDoF: true,
    includeHullVertices: true,
    includePerimeter: true,
    includeAnalysis: true,
  };
  const graphs = parsed.data.contactClasses.map((configuration) =>
    createPackingExportGraph(configuration, options, DEFAULT_CRITICALITY_TOLERANCE),
  );
  const exportedData = {
    version: '1.1',
    indexing: '0-based',
    angles: 'degrees',
    radius: '1',
    graphs,
  };

  const outputDirectory = 'exports';
  const outputPath = path.join(outputDirectory, `${diskCount}disks_all_configurations.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(exportedData, null, 4)}\n`);

  console.log(`Exported ${graphs.length} configurations with advanced analysis to ${outputPath}`);
  if (parsed.warnings.length > 0) {
    console.warn(`Parser reported ${parsed.warnings.length} numerical warnings; see the app console for details.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
