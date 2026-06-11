/**
 * Seed the Projects + Technologies collections with real past work.
 *
 * Idempotent: technologies upsert by `name`, projects upsert by `slug`, so it
 * is safe to run repeatedly and against a database that already has content
 * (existing docs with the same slug are updated, others are left alone).
 *
 *   cd app && npm run seed
 *
 * Works locally (docker compose db on localhost:5432, see app/.env) and, when
 * pointed at prod via DATABASE_URL, can seed the live site the same way.
 * (`payload run` exits silently without executing in this setup, so we run
 * via tsx; dotenv loads app/.env without overriding already-exported vars.)
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from './payload.config.ts'

// --- Minimal lexical richText builders (matches the shape the admin editor
// saves), so seeded projects have a real case-study body. ---
const text = (t: string) => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: t,
  version: 1,
})

const p = (t: string) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr' as const,
  children: [text(t)],
})

const body = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map(p),
  },
})

const TECHNOLOGIES: { name: string; category: string; url?: string }[] = [
  { name: 'Python', category: 'language', url: 'https://www.python.org' },
  { name: 'C++', category: 'language' },
  { name: 'C', category: 'language' },
  { name: 'C#', category: 'language' },
  { name: 'TypeScript', category: 'language', url: 'https://www.typescriptlang.org' },
  { name: 'VHDL', category: 'language' },
  { name: 'React', category: 'framework', url: 'https://react.dev' },
  { name: 'Next.js', category: 'framework', url: 'https://nextjs.org' },
  { name: 'Payload CMS', category: 'framework', url: 'https://payloadcms.com' },
  { name: 'AWS', category: 'platform', url: 'https://aws.amazon.com' },
  { name: 'Terraform', category: 'tool', url: 'https://www.terraform.io' },
  { name: 'Docker', category: 'tool', url: 'https://www.docker.com' },
  { name: 'PostgreSQL', category: 'database', url: 'https://www.postgresql.org' },
  { name: 'OpenWRT', category: 'platform', url: 'https://openwrt.org' },
  { name: 'MQTT', category: 'tool', url: 'https://mqtt.org' },
  { name: 'Xilinx Zynq', category: 'platform' },
  { name: 'PetaLinux', category: 'platform' },
  { name: 'LabVIEW', category: 'tool' },
  { name: 'MATLAB', category: 'tool' },
  { name: 'SysML', category: 'tool' },
  { name: 'Cameo / MagicDraw', category: 'tool' },
  { name: 'TensorFlow', category: 'framework', url: 'https://www.tensorflow.org' },
  { name: 'YOLO', category: 'framework' },
  { name: 'Whisper', category: 'framework' },
  { name: 'Gradio', category: 'framework', url: 'https://gradio.app' },
  { name: 'Hugging Face', category: 'platform', url: 'https://huggingface.co' },
  { name: 'WordPress', category: 'platform', url: 'https://wordpress.org' },
  { name: 'Fusion 360', category: 'tool' },
  { name: 'Raspberry Pi', category: 'platform', url: 'https://www.raspberrypi.com' },
]

type SeedProject = {
  slug: string
  title: string
  client?: string
  description: string
  bodyParagraphs: string[]
  technologies: string[]
  liveUrl?: string
  featured?: boolean
  publishedAt: string
  outcomes?: string
  schemaType?: 'CreativeWork' | 'WebApplication' | 'SoftwareSourceCode' | 'Service'
}

const PROJECTS: SeedProject[] = [
  {
    slug: 'speech-to-task-mobile-neural-networks',
    title: 'Speech-to-Task on Mobile-Friendly Neural Networks',
    client: 'AI startup',
    description:
      'Live speech-to-task prototype built on Whisper Tiny, Deepgram, and Gemma 3n, with free-tier Hugging Face hosting and competition-ready technical documentation.',
    bodyParagraphs: [
      'The client needed a working demonstration that small, mobile-friendly neural networks could turn free-form speech into structured tasks — and they needed it presentable for a Kaggle competition deadline.',
      'I built a live prototype with a Gradio front end that pipes audio through Whisper Tiny and Deepgram for transcription and uses Gemma 3n for task extraction. The demo is configured for Hugging Face Spaces free-tier hosting, so it stays online long-term at no cost.',
      'Alongside the prototype I prepared the technical documentation the team used for the competition, covering model selection trade-offs and the on-device constraints that drove them.',
    ],
    technologies: ['Python', 'Whisper', 'Gradio', 'Hugging Face'],
    liveUrl: 'https://huggingface.co/spaces/mrmarkhf/raynos-ai-cpu',
    featured: true,
    publishedAt: '2025-08-15T00:00:00.000Z',
    outcomes: 'Live demo delivered before the competition deadline; hosted long-term on free-tier infrastructure.',
    schemaType: 'WebApplication',
  },
  {
    slug: 'bacteria-detection-computer-vision',
    title: 'Bacteria Detection Computer Vision Platform',
    client: 'Biotech client',
    description:
      'AWS microservice platform for automated bacteria detection: React front end, GPU inference backend, and a custom YOLO architecture tailored to the detection task.',
    bodyParagraphs: [
      'Counting and classifying bacteria colonies by eye is slow and error-prone. This engagement delivered an end-to-end computer-vision platform that automates it.',
      'The system is built as AWS microservices: a React front end for uploading and reviewing samples, and a GPU-backed inference service running a YOLO architecture customized for the size and density characteristics of bacteria imagery.',
      'Beyond the model work, I provided project management and a development roadmap so the client team could carry the platform forward after handoff.',
    ],
    technologies: ['Python', 'YOLO', 'React', 'AWS', 'Docker'],
    featured: true,
    publishedAt: '2025-10-15T00:00:00.000Z',
    outcomes: 'Custom YOLO model and GPU microservice delivered with a handoff roadmap the client team now executes independently.',
    schemaType: 'WebApplication',
  },
  {
    slug: 'considerate-systems-platform',
    title: 'This Website: Payload + Next.js on AWS Fargate',
    client: 'Considerate Systems LLC',
    description:
      'The turnkey platform this site runs on: Payload CMS + Next.js in one container on ECS Fargate, fully defined in Terraform, with an adaptive HLS video pipeline on MediaConvert.',
    bodyParagraphs: [
      'Most managed CMS hosting starts cheap and gets expensive exactly when your traffic grows. This platform flips that: a Payload CMS + Next.js application in a single container on ECS Fargate, with RDS Postgres, S3 + CloudFront media delivery, and every resource defined in Terraform — so a new site stands up with one apply and costs less per user as it scales.',
      'The video pipeline transcodes uploads to adaptive HLS with AWS MediaConvert and Lambda, preserving source quality at the top rung and adapting down per client and network. Pages are edge-cached with ISR, and deploys are gated on database migrations completing cleanly.',
      'The repository doubles as the template for client sites: the same image becomes a different site by injecting different environment values.',
    ],
    technologies: ['TypeScript', 'Next.js', 'Payload CMS', 'AWS', 'Terraform', 'Docker', 'PostgreSQL'],
    liveUrl: 'https://github.com/mmusil25/considerate-website',
    featured: true,
    publishedAt: '2026-05-15T00:00:00.000Z',
    outcomes: 'Production site served from edge cache on infrastructure costing a fraction of managed-CMS hosting.',
    schemaType: 'SoftwareSourceCode',
  },
  {
    slug: 'smart-water-heater-iot-fleet',
    title: 'Smart Water Heater IoT Fleet',
    client: 'Armada Power',
    description:
      'C++ embedded Linux development for grid-scale fleets of IoT water heaters: OpenWRT-based OS with real-time MQTT, time-series anomaly detection, SysML modeling, and L/S/C-band RF design.',
    bodyParagraphs: [
      'Armada Power turns residential water heaters into a controllable grid resource. I worked across their embedded stack: C++ development on an OpenWRT-based embedded Linux OS integrating live sensor data over MQTT.',
      'On the analytics side, I built time-series anomaly detection to provide predictive-maintenance signals for multi-family housing clients. On the hardware side: component-level PCB design in Fusion 360 and WiFi/LTE/Bluetooth RF design and testing in L, S, and C band.',
      'I also brought model-based systems engineering to the codebase — reverse-engineering existing C++ into SysML/UML models of the switching fleet and its embedded devices, giving the team an architecture they could reason about.',
    ],
    technologies: ['C++', 'OpenWRT', 'MQTT', 'SysML', 'Fusion 360', 'Python'],
    publishedAt: '2025-05-15T00:00:00.000Z',
    schemaType: 'CreativeWork',
  },
  {
    slug: 'counter-drone-systems-engineering',
    title: 'Counter-Drone Systems Architecture',
    client: 'ManTech',
    description:
      'Architected large-scale counter-drone systems with MBSE and SysML in MagicDraw/Cameo, plus C++ drivers and Python/LabVIEW/MATLAB radar signal processing.',
    bodyParagraphs: [
      'Counter-drone defense is a system-of-systems problem: radars, RF sensors, effectors, and software that must agree on what they are seeing. At ManTech I architected these systems using model-based systems engineering with SysML in MagicDraw and Cameo.',
      'Beyond architecture, the work was hands-on: C++ drivers and GUIs, signal-processing methods in Python, LabVIEW, and MATLAB for radar applications, and design and characterization of the radio-frequency chain itself.',
      'Rigorous MBSE practice on these programs contributed directly to growing the contract pool — models that customers can interrogate are easier to buy than slide decks.',
    ],
    technologies: ['SysML', 'Cameo / MagicDraw', 'C++', 'Python', 'LabVIEW', 'MATLAB'],
    publishedAt: '2022-11-15T00:00:00.000Z',
    schemaType: 'CreativeWork',
  },
  {
    slug: 'ground-penetrating-radar',
    title: 'Ground-Penetrating Radar Platform',
    client: 'Sawback Technologies',
    description:
      'Led engineering of a ground-penetrating radar system: PetaLinux on Xilinx SoC/FPGA, Zynq7000 embedded C for acquisition and control, and UHF analog design.',
    bodyParagraphs: [
      'As lead engineer for Sawback Technologies I set team development goals and owned the embedded platform for a ground-penetrating radar system.',
      'The stack ran PetaLinux on a Xilinx SoC, with FPGA logic interfacing the RF board’s ADCs and frequency synthesizer, and embedded C on the Zynq7000 processing system handling SPI communications, data acquisition, and control. I also did analog circuit design for the ultrahigh-frequency front end.',
      'System debug ran through logic analyzers, spectrum analyzers, and oscilloscopes — and the findings ran through me to investors, translating system-level engineering into non-technical status reports.',
    ],
    technologies: ['C', 'Xilinx Zynq', 'PetaLinux', 'VHDL'],
    publishedAt: '2021-05-15T00:00:00.000Z',
    schemaType: 'CreativeWork',
  },
  {
    slug: 'radar-control-software',
    title: 'Radar Hardware Control & Test Software',
    client: 'ECS Federal',
    description:
      'Real-time radar coordination in C# over Modbus TCP, LabVIEW hardware-control GUIs, C++ data processing, and GitLab CI/CD deployed on AWS ECS.',
    bodyParagraphs: [
      'Radar test systems need software that speaks to hardware reliably and in real time. At ECS Federal I used C# with Modbus TCP to coordinate hardware over Ethernet for real-time systems work.',
      'I developed LabVIEW GUIs for hardware control of radar systems, C++ for hardware control and data processing, and Python tooling to automate documentation and perform high-level testing.',
      'I also designed the team’s GitLab version-control architecture for AWS and implemented it on Elastic Container Service — the same container-orchestration platform this website runs on.',
    ],
    technologies: ['C#', 'LabVIEW', 'C++', 'Python', 'AWS'],
    publishedAt: '2023-07-15T00:00:00.000Z',
    schemaType: 'CreativeWork',
  },
  {
    slug: 'herbal-mission-ecommerce',
    title: 'Small-Business eCommerce on AWS',
    client: 'The Herbal Mission',
    description:
      'Custom eCommerce site for a handcrafted soap business, hosted on AWS EC2 — including shipping, billing, maintenance, and ongoing technical support.',
    bodyParagraphs: [
      'The Herbal Mission sells handcrafted soap and needed more than a website: they needed a technical partner. I built and host their custom eCommerce site on AWS EC2.',
      'The engagement is end-to-end small-business support: shipping and billing integration, website maintenance, AWS backend management, and general web consulting as the business grows.',
      'It is a good example of the retainer model — a small monthly commitment that keeps an engineer on call, instead of a big agency invoice for every change.',
    ],
    technologies: ['WordPress', 'AWS'],
    liveUrl: 'https://www.theherbalmission.net/',
    publishedAt: '2024-03-15T00:00:00.000Z',
    schemaType: 'Service',
  },
  {
    slug: 'openwrt-raspberry-pi-router',
    title: 'OpenWRT Router on a Raspberry Pi',
    description:
      'Custom embedded Linux router build — OpenWRT on a Raspberry Pi with an unmanaged switch — written up as a public walkthrough on networking fundamentals.',
    bodyParagraphs: [
      'A home router you built yourself is the best networking teacher there is. This project turns a Raspberry Pi and an unmanaged switch into a fully functional router running OpenWRT.',
      'The public walkthrough covers building a custom OpenWRT image, VLAN configuration over a single physical port, and the firewall and DHCP plumbing that makes it a real router rather than a science fair project.',
      'The same OpenWRT skill set carries directly into commercial work — it is the OS family I used for production IoT fleets at Armada Power.',
    ],
    technologies: ['OpenWRT', 'Raspberry Pi'],
    liveUrl: 'https://www.markmusil.click/creating-an-openwrt-router-using-a-raspberry-pi-and-an-unmanaged-switch/',
    publishedAt: '2024-12-15T00:00:00.000Z',
    schemaType: 'CreativeWork',
  },
  {
    slug: 'wafer-defect-detection',
    title: 'DNN Wafer-Defect Detection at Intel',
    client: 'Intel Corporation',
    description:
      'Computer-vision wafer-defect detection tool that reduced validation time on Intel’s silicon assembly line, plus automated neural-architecture search in TensorFlow/Keras.',
    bodyParagraphs: [
      'On Intel’s silicon wafer assembly line, validation time is money. As a machine learning engineering intern I developed a DNN computer-vision tool for wafer defect detection that reduced validation time, alongside data quality control for TEM metrology generation.',
      'I also scripted a neural-network optimization system that automatically searched for ideal architectures and hyperparameters for a given application, and developed a repeatable methodology for standing up CUDA-enabled training environments on new machines.',
    ],
    technologies: ['Python', 'TensorFlow'],
    publishedAt: '2019-09-15T00:00:00.000Z',
    outcomes: 'Reduced wafer validation time on a production assembly line.',
    schemaType: 'CreativeWork',
  },
]

async function run() {
  const payload = await getPayload({ config })

  // --- Technologies: upsert by unique name ---
  const techIds = new Map<string, number | string>()
  for (const tech of TECHNOLOGIES) {
    const existing = await payload.find({
      collection: 'technologies',
      where: { name: { equals: tech.name } },
      limit: 1,
    })
    if (existing.docs[0]) {
      techIds.set(tech.name, existing.docs[0].id)
    } else {
      const created = await payload.create({ collection: 'technologies', data: tech as any })
      techIds.set(tech.name, created.id)
      payload.logger.info(`technology created: ${tech.name}`)
    }
  }

  // --- Projects: upsert by unique slug ---
  for (const proj of PROJECTS) {
    const data = {
      title: proj.title,
      slug: proj.slug,
      client: proj.client,
      description: proj.description,
      body: body(...proj.bodyParagraphs),
      technologies: proj.technologies.map((name) => {
        const id = techIds.get(name)
        if (!id) throw new Error(`unknown technology in seed data: ${name}`)
        return { tech: id }
      }),
      liveUrl: proj.liveUrl,
      featured: proj.featured ?? false,
      publishedAt: proj.publishedAt,
      structuredData: {
        schemaType: proj.schemaType ?? 'CreativeWork',
        outcomes: proj.outcomes,
      },
    }

    const existing = await payload.find({
      collection: 'projects',
      where: { slug: { equals: proj.slug } },
      limit: 1,
    })
    if (existing.docs[0]) {
      await payload.update({ collection: 'projects', id: existing.docs[0].id, data: data as any })
      payload.logger.info(`project updated: ${proj.slug}`)
    } else {
      await payload.create({ collection: 'projects', data: data as any })
      payload.logger.info(`project created: ${proj.slug}`)
    }
  }

  payload.logger.info('seed complete')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
