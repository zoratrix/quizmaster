import { collectMedia, createEmptyPack, normalizePack } from '../../src/shared/factory';
import type { MediaAsset, MediaKind } from '../../src/shared/types';
import { test, eq } from './harness';

function asset(id: string, kind: MediaKind): MediaAsset {
  return {
    id,
    kind,
    fileName: `${id}.${kind === 'audio' ? 'mp3' : kind === 'video' ? 'mp4' : 'png'}`,
    mimeType: kind === 'audio' ? 'audio/mpeg' : kind === 'video' ? 'video/mp4' : 'image/png',
    size: 10,
    sha256: ''
  };
}

test('Новый пак: музыка и обложки пустые', () => {
  const pack = createEmptyPack();
  eq(pack.music, []);
  eq(pack.rounds[0].cover, null);
  eq(pack.rounds[0].questions[0].answerImage, null);
});

test('normalizePack восстанавливает старый пак без новых полей', () => {
  const pack = normalizePack({
    schemaVersion: 1,
    theme: 'blue',
    title: 'Старый пак',
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5 },
    rounds: [
      {
        id: 'r1',
        title: 'Раунд 1',
        questions: [
          {
            id: 'q1',
            text: 'Вопрос',
            answer: 'Ответ',
            explanation: '',
            timeLimitSec: 60,
            points: 1,
            media: { image: null, audio: null, video: null }
          }
        ]
      }
    ]
  });
  eq(pack.music, []);
  eq(pack.rounds[0].cover, null);
  eq(pack.rounds[0].questions[0].answerImage, null);
});

test('normalizePack читает обложку, картинку ответа и плейлист', () => {
  const cover = asset('m_cover', 'image');
  const answer = asset('m_answer', 'image');
  const track = asset('m_track', 'audio');
  const pack = normalizePack({
    schemaVersion: 2,
    title: 'Пак с медиа',
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5 },
    music: [track],
    rounds: [
      {
        id: 'r1',
        title: 'Раунд 1',
        cover,
        questions: [
          {
            id: 'q1',
            text: 'Вопрос',
            answer: 'Ответ',
            answerImage: answer,
            explanation: '',
            timeLimitSec: 60,
            points: 1,
            media: { image: null, audio: null, video: null }
          }
        ]
      }
    ]
  });
  eq(pack.music, [track]);
  eq(pack.rounds[0].cover, cover);
  eq(pack.rounds[0].questions[0].answerImage, answer);
});

test('collectMedia собирает музыку, обложки, картинки ответов и медиа вопросов', () => {
  const pack = createEmptyPack();
  const questionImage = asset('m_q_image', 'image');
  const questionAudio = asset('m_q_audio', 'audio');
  const answerImage = asset('m_answer', 'image');
  const cover = asset('m_cover', 'image');
  const track = asset('m_track', 'audio');

  pack.music = [track];
  pack.rounds[0].cover = cover;
  pack.rounds[0].questions[0].answerImage = answerImage;
  pack.rounds[0].questions[0].media.image = questionImage;
  pack.rounds[0].questions[0].media.audio = questionAudio;

  const ids = collectMedia(pack).map((item) => item.id).sort();
  eq(ids, [answerImage.id, cover.id, questionAudio.id, questionImage.id, track.id].sort());
});
