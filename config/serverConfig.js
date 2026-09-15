import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = os.platform() === 'win32';
export const PIPER_COMMAND = isWindows ? path.join(__dirname, '..', 'piper.exe') : 'piper';
export const VOICE_MODEL_PATH = path.join(__dirname, '..', 'es_AR-daniela-high.onnx');
export const TEMP_DIR = path.join(__dirname, '..', 'temp');
