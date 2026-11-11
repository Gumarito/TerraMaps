/**
 * CLI Runner for TerraMaps Verification Test Suite
 */

import { runAllVerifications } from './mathVerification.ts';

async function main() {
  console.log('====================================================');
  console.log('🧪 TERRAMAPS - SUITE DE VERIFICACIÓN MATEMÁTICA');
  console.log('====================================================\n');

  try {
    const results = await runAllVerifications();
    let allPassed = true;

    for (const r of results) {
      const statusIcon = r.passed ? '✅ PASÓ' : '❌ FALLÓ';
      console.log(`[${statusIcon}] ${r.suiteName} (${r.assertions} aserciones)`);
      if (!r.passed) {
        allPassed = false;
        for (const f of r.failures) {
          console.log(`   ⚠️ Error: ${f}`);
        }
      }
    }

    console.log('\n----------------------------------------------------');
    if (allPassed) {
      console.log('🎉 TODAS LAS VERIFICACIONES MATEMÁTICAS PASARON AL 100%');
    } else {
      console.log('🚨 ALGUNAS ASRECIONES FALLARON');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Excepción ejecutando la suite:', err);
    process.exit(1);
  }
}

main();
