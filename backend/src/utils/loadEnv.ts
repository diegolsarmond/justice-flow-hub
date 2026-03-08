import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const cwdPath = process.cwd();
const cwdEnvPath = path.resolve(cwdPath, '.env');
const cwdParentEnvPath = path.resolve(cwdPath, '../.env');
const isBackendCwd = path.basename(cwdPath) === 'backend';

const envCandidates = [
  isBackendCwd ? cwdParentEnvPath : cwdEnvPath,
  isBackendCwd ? cwdEnvPath : cwdParentEnvPath,
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];

const resolvedEnvPath = envCandidates.find((envPath) => fs.existsSync(envPath));

if (resolvedEnvPath) {
  const result = dotenv.config({ path: resolvedEnvPath });
  console.info(`[loadEnv] Arquivo .env carregado de: ${resolvedEnvPath}`);
  console.info(`[loadEnv] Keys presentes no .env carregado: ${Object.keys(result.parsed || {}).join(', ')}`);
} else {
  dotenv.config();
  console.warn(
    `[loadEnv] Nenhum .env encontrado. Caminhos verificados: ${envCandidates.join(', ')}`,
  );
}
