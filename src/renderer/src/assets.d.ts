/** Аудио-ассеты подключаются Vite как URL. */
declare module '*.mp3' {
  const src: string;
  export default src;
}
