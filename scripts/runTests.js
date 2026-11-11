const path = require('path');

async function main() {
  try {
    const { runAllVerifications } = require(path.join(__dirname, '..', 'dist-tests', 'tests', 'mathVerification.js'));
    console.log('--- EJECUTANDO SUITE DE VERIFICACIÓN MATEMÁTICA Y ARQUITECTURA TERRAMAPS ---');
    const results = await runAllVerifications();
    let totalAssertions = 0;
    let allPassed = true;

    for (const r of results) {
      totalAssertions += r.assertions;
      const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${statusIcon} | ${r.suiteName} (${r.assertions} aserciones)`);
      if (!r.passed) {
        allPassed = false;
        console.error('  Fallos:', r.failures);
      }
    }

    console.log('----------------------------------------------------------------------');
    console.log(`TOTAL ASERCIONES VERIFICADAS: ${totalAssertions}`);
    console.log(`ESTADO FINAL: ${allPassed ? 'TODAS LAS PRUEBAS PASARON AL 100%' : 'FALLOS DETECTADOS'}`);
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Error al ejecutar pruebas:', err);
    process.exit(1);
  }
}

main();
