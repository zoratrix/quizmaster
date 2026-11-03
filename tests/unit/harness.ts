import assert from 'node:assert';

console.log('\nQuizMaster — юнит-тесты расчёта баллов и статистики\n');

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`  ✗ ${name}`);
    console.error(`    ${message.split('\n').join('\n    ')}`);
  }
}

export function eq<T>(actual: T, expected: T, label = ''): void {
  assert.deepStrictEqual(actual, expected, label);
}

export function close(actual: number, expected: number, label = '', epsilon = 0.0001): void {
  assert.ok(Math.abs(actual - expected) < epsilon, `${label}: ожидалось ${expected}, получено ${actual}`);
}

export function finish(): void {
  console.log(`\nИтого: ${passed} успешно, ${failed} провалено`);
  if (failed > 0) {
    console.error('\nПроваленные проверки:');
    for (const item of failures) console.error(` - ${item}`);
    process.exitCode = 1;
  }
}
