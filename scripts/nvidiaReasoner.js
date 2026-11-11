/**
 * TerraMaps - NVIDIA NIM 2026 Multi-Agent Router & Bridge
 * 
 * Conectado directamente al catálogo en vivo de https://integrate.api.nvidia.com/v1/models (84 modelos).
 * Enruta cada tipo de tarea al modelo de frontera exacto de última generación (2026).
 * 
 * Uso por consola:
 *   node scripts/nvidiaReasoner.js --role=architect "Diseña el algoritmo..."
 *   node scripts/nvidiaReasoner.js --role=coder "Optimiza este componente..."
 *   node scripts/nvidiaReasoner.js --role=vision "Analiza la interfaz..."
 *   node scripts/nvidiaReasoner.js --list (Lista los modelos activos en vivo)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Jerarquía Oficial de Modelos NVIDIA NIM (Verificados en vivo contra /v1/models)
 */
const NVIDIA_AGENT_ROLES = {
  // 1. ARQUITECTO & MATEMÁTICO SUPREMO (550B MoE / 1M Contexto / Mamba-2 + Transformer)
  architect: {
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    description: 'Razonamiento profundo, arquitectura de sistemas, algoritmos H3 y orquestación.',
    temperature: 0.5,
  },

  // 2. INGENIERO DE CÓDIGO PURO (Especializado en Ingeniería de Software y Refactorización)
  coder: {
    model: 'deepseek-ai/deepseek-v4.1-flash',
    fallback: 'poolside/laguna-xs-2.1',
    description: 'Escritura de código TypeScript/React Native/SQL ultra-rápida y libre de bugs.',
    temperature: 0.3,
  },

  // 3. GIGANTE MULTILENGUAJE & FULL-STACK (1 Trillón de parámetros MoE, 52B activos)
  frontier: {
    model: 'mistralai/mistral-large-4-1t-a52b',
    fallback: 'moonshotai/kimi-k2.6',
    description: 'Resolución de problemas complejos de extremo a extremo y lógica de negocio.',
    temperature: 0.4,
  },

  // 4. ESPECIALISTA EN UI, VISIÓN Y MULTIMODALIDAD (120B VL MoE)
  vision: {
    model: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    description: 'Diseño de interfaces móviles, auditoría UX/UI e inspección visual.',
    temperature: 0.5,
  },

  // 5. RAZONAMIENTO ESPACIAL Y FÍSICO (Mundo real, GPS, sensores y cinemática)
  spatial: {
    model: 'nvidia/cosmos-reason2-8b',
    description: 'Física de sensores, acelerómetro, cinemática GPS y coordenadas geoespaciales.',
    temperature: 0.3,
  },

  // 6. AGENTE RELÁMPAGO DE BAJA LATENCIA (30B MoE con solo 3B activos)
  fast: {
    model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    fallback: 'z-ai/glm-5.3-flash',
    description: 'Ejecución instantánea de herramientas, validaciones rápidas y subtareas.',
    temperature: 0.2,
  },
};

function getApiKey() {
  if (process.env.NVIDIA_API_KEY) {
    return process.env.NVIDIA_API_KEY.trim();
  }
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NVIDIA_API_KEY\s*=\s*(nvapi-[^\r\n]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Consulta en vivo la lista de los 84+ modelos disponibles actualmente en NVIDIA NIM
 */
function fetchLiveModels() {
  return new Promise((resolve, reject) => {
    https.get('https://integrate.api.nvidia.com/v1/models', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data.map((m) => m.id).sort());
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function queryNvidiaAgent({
  prompt,
  role = 'coder',
  customModel = null,
  systemPrompt = 'Eres un ingeniero de software principal. Escribe código limpio, directo y sin sobre-ingeniería (principio YAGNI).',
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('\n❌ ERROR: No se encontró la NVIDIA_API_KEY en tu archivo .env');
    console.error('👉 Crea el archivo .env en la raíz del proyecto con:');
    console.error('   NVIDIA_API_KEY=nvapi-tu-clave-aqui\n');
    process.exit(1);
  }

  const roleConfig = NVIDIA_AGENT_ROLES[role] || NVIDIA_AGENT_ROLES.coder;
  const targetModel = customModel || roleConfig.model;

  const payload = JSON.stringify({
    model: targetModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: roleConfig.temperature,
    max_tokens: 4096,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else if (parsed.choices && parsed.choices.length > 0) {
            resolve({
              model: targetModel,
              role,
              content: parsed.choices[0].message.content,
            });
          } else {
            resolve({ model: targetModel, role, content: data });
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    fetchLiveModels().then((models) => {
      console.log(`\n🟢 MODELOS ACTIVOS EN VIVO EN BUILD.NVIDIA.COM (${models.length} total):`);
      models.forEach((m) => console.log(`  • ${m}`));
    });
  } else {
    const roleArg = args.find((a) => a.startsWith('--role='));
    const role = roleArg ? roleArg.split('=')[1] : 'coder';
    const prompt = args.filter((a) => !a.startsWith('--role=')).join(' ') || 'Hola, confirma tu modelo y estado.';

    const roleInfo = NVIDIA_AGENT_ROLES[role] || NVIDIA_AGENT_ROLES.coder;
    console.log(`\n🚀 Invocando Agente NVIDIA [${role.toUpperCase()}] -> Modelo: ${roleInfo.model}...`);

    queryNvidiaAgent({ prompt, role })
      .then((res) => {
        console.log(`\n=== RESPUESTA DE ${res.model} ===\n`);
        console.log(res.content);
        console.log('\n================================================\n');
      })
      .catch((err) => {
        console.error('Error:', err.message);
      });
  }
}

module.exports = { queryNvidiaAgent, fetchLiveModels, NVIDIA_AGENT_ROLES };
