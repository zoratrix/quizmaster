/**
 * Генератор демонстрационных игровых паков (packs/*.quizpack).
 * Запуск: node scripts/make-demo-packs.mjs
 *
 * Картинки и звук создаются программно, чтобы демо работало полностью офлайн
 * и не зависело от внешних файлов.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packsDir = path.join(root, 'packs');

const SCHEMA_VERSION = 2;

// ---------- Генерация PNG ----------

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter type
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function makeSpaceImage(width = 1280, height = 720) {
  const planets = [
    { x: 0.24, y: 0.36, r: 0.11, inner: [255, 196, 110], outer: [214, 108, 40] },
    { x: 0.62, y: 0.58, r: 0.2, inner: [150, 210, 255], outer: [32, 78, 168] },
    { x: 0.83, y: 0.24, r: 0.07, inner: [255, 255, 255], outer: [180, 180, 210] }
  ];
  return encodePng(width, height, (x, y) => {
    const nx = x / width;
    const ny = y / height;
    // фон: глубокий космос с фиолетовым градиентом
    let r = Math.round(14 + 26 * ny + 10 * Math.sin(nx * 3.2));
    let g = Math.round(12 + 20 * ny + 8 * Math.cos(ny * 2.4));
    let b = Math.round(38 + 46 * (1 - ny) + 18 * Math.sin(nx * 1.7));
    // звёзды
    const star = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const noise = star - Math.floor(star);
    if (noise > 0.9975) {
      const bright = 180 + Math.round(75 * noise);
      r = Math.min(255, r + bright * 0.5);
      g = Math.min(255, g + bright * 0.5);
      b = Math.min(255, b + bright * 0.5);
    }
    // планеты
    for (const planet of planets) {
      const cx = planet.x * width;
      const cy = planet.y * height;
      const radius = planet.r * Math.min(width, height);
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < radius) {
        const t = distance / radius;
        const light = 1 - t;
        r = Math.round(planet.outer[0] + (planet.inner[0] - planet.outer[0]) * light);
        g = Math.round(planet.outer[1] + (planet.inner[1] - planet.outer[1]) * light);
        b = Math.round(planet.outer[2] + (planet.inner[2] - planet.outer[2]) * light);
        // блик
        const shine = Math.hypot(x - (cx - radius * 0.35), y - (cy - radius * 0.35));
        if (shine < radius * 0.3) {
          const k = 1 - shine / (radius * 0.3);
          r = Math.min(255, Math.round(r + 90 * k));
          g = Math.min(255, Math.round(g + 90 * k));
          b = Math.min(255, Math.round(b + 90 * k));
        }
      }
    }
    return [r, g, b];
  });
}

// ---------- Генерация WAV ----------

function makeMelodyWav() {
  const sampleRate = 44100;
  const notes = [
    { freq: 523.25, dur: 0.32 },
    { freq: 659.25, dur: 0.32 },
    { freq: 783.99, dur: 0.32 },
    { freq: 1046.5, dur: 0.6 },
    { freq: 783.99, dur: 0.28 },
    { freq: 659.25, dur: 0.28 },
    { freq: 523.25, dur: 0.75 }
  ];
  const totalSamples = notes.reduce((sum, note) => sum + Math.floor(note.dur * sampleRate), 0);
  const buffer = Buffer.alloc(44 + totalSamples * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(totalSamples * 2, 40);

  let offset = 44;
  for (const note of notes) {
    const count = Math.floor(note.dur * sampleRate);
    for (let i = 0; i < count; i += 1) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t * 40) * Math.min(1, (note.dur - t) * 12);
      const value = Math.sin(2 * Math.PI * note.freq * t) * 0.32 * envelope;
      const sample = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
      buffer.writeInt16LE(sample, offset);
      offset += 2;
    }
  }
  return buffer;
}

// ---------- Сборка пака ----------

function sha16(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function asset(id, kind, fileName, mimeType, buffer) {
  return {
    asset: {
      id,
      kind,
      fileName,
      mimeType,
      size: buffer.byteLength,
      sha256: sha256(buffer)
    },
    buffer,
    entry: `media/${assetEntryName(id, fileName)}`
  };
}

function assetEntryName(id, fileName) {
  const ext = path.extname(fileName).toLowerCase() || '.bin';
  return `${id}${ext}`;
}

function question(id, text, answer, explanation = '', points = 1, timeLimitSec = 60, media = {}) {
  return {
    id,
    text,
    answer,
    answerMedia: { image: null, audio: null, video: null },
    explanation,
    timeLimitSec,
    points,
    media: {
      image: media.image ?? null,
      audio: media.audio ?? null,
      video: media.video ?? null
    }
  };
}

function buildPack({ id, title, description, rounds, theme = 'default' }) {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    theme,
    id,
    title,
    description,
    createdAt: now,
    updatedAt: now,
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5, answerRevealSec: 15 },
    music: [],
    rounds: rounds.map((round) => ({ cover: null, ...round }))
  };
}

async function writePack(fileName, pack, assets) {
  const zip = new AdmZip();
  const media = [];
  for (const item of assets) {
    zip.addFile(item.entry, item.buffer);
    media.push({ asset: item.asset, entry: item.entry });
  }
  const manifest = { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), pack, media };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  const target = path.join(packsDir, fileName);
  await writeFile(target, zip.toBuffer());
  const size = (await import('node:fs')).statSync(target).size;
  console.log(`  ${fileName} — ${Math.round(size / 1024)} КБ`);
}

async function main() {
  await mkdir(packsDir, { recursive: true });

  const spacePng = makeSpaceImage();
  const melody = makeMelodyWav();
  const imageAsset = asset(`m_${sha16(spacePng)}`, 'image', 'kosmos.png', 'image/png', spacePng);
  const audioAsset = asset(`m_${sha16(melody)}`, 'audio', 'melodiya.wav', 'audio/wav', melody);

  console.log('Создаю демонстрационные паки:');

  await writePack(
    'demo-space.quizpack',
    buildPack({
      id: 'demo_space',
      theme: 'blue',
      title: 'Демо-квиз: Космос',
      description: 'Небольшой демонстрационный квиз с картинкой и музыкой. Показывает, как работают раунды, медиа, таймер и подсчёт баллов.',
      rounds: [
        {
          id: 'r_space_1',
          title: 'Раунд 1. Разминка',
          questions: [
            question(
              'q_space_1',
              'Какая планета Солнечной системы самая большая?',
              'Юпитер',
              'Диаметр Юпитера — около 143 000 км, это в 11 раз больше диаметра Земли.',
              1,
              30
            ),
            question(
              'q_space_2',
              'Сколько планет в Солнечной системе?',
              '8',
              'С 2006 года Плутон считается карликовой планетой.',
              1,
              20
            ),
            question(
              'q_space_3',
              'Что изображено на картинке: планета, звезда или галактика?',
              'Планеты на фоне звёздного неба',
              'Это художественная иллюстрация: несколько планет в открытом космосе.',
              1,
              25,
              { image: imageAsset.asset }
            )
          ]
        },
        {
          id: 'r_space_2',
          title: 'Раунд 2. Медиа',
          questions: [
            question(
              'q_space_4',
              'Послушайте мелодию: сколько разных нот в ней прозвучало?',
              'Четыре ноты: до, ми, соль, до второй октавы',
              'Мелодия построена на мажорном трезвучии.',
              2,
              45,
              { audio: audioAsset.asset }
            ),
            question(
              'q_space_5',
              'Кто первым вышел в открытый космос?',
              'Алексей Леонов',
              'Выход состоялся 18 марта 1965 года, продолжительность — 12 минут 9 секунд.',
              2,
              40
            )
          ]
        }
      ]
    }),
    [imageAsset, audioAsset]
  );

  await writePack(
    'demo-quick.quizpack',
    buildPack({
      id: 'demo_quick',
      theme: 'summer',
      title: 'Демо-квиз: Быстрый старт',
      description: 'Мини-пак из одного раунда — удобно, чтобы быстро проверить всю цепочку: лобби, вопрос, баллы, итоги.',
      rounds: [
        {
          id: 'r_quick_1',
          title: 'Единственный раунд',
          questions: [
            question('q_quick_1', 'Сколько цветов в радуге?', 'Семь', 'Каждый охотник желает знать…', 1, 20),
            question('q_quick_2', 'В каком городе находится Эйфелева башня?', 'Париж', '', 1, 20),
            question('q_quick_3', 'Сколько будет 12 × 12?', '144', '', 2, 30)
          ]
        }
      ]
    }),
    []
  );

  console.log('\nГотово. Паки лежат в папке packs.');
}

await main();
