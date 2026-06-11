import type { Metadata } from 'next'
import { SiteHeader } from '../components/SiteHeader'

export const metadata: Metadata = {
  title: 'Services — Considerate Systems LLC',
  description:
    'Embedded systems and firmware, electrical and RF engineering, model-based systems engineering, web and cloud development, and applied machine learning. Hourly, retainer, and fixed-price engagements.',
}

type Service = {
  name: string
  blurb: string
  tools: string
}

const services: Service[] = [
  {
    name: 'Embedded Systems & Firmware',
    blurb:
      'Embedded Linux (OpenWRT, PetaLinux, Debian), bare-metal and RTOS firmware in C/C++, Xilinx Zynq SoC/FPGA development in VHDL and Verilog, sensor and bus integration (SPI, I2C, Modbus, SDI-12, RS-485), and IoT fleets with real-time MQTT messaging.',
    tools: 'C/C++ · OpenWRT · Zynq7000 · VHDL · MQTT · Raspberry Pi',
  },
  {
    name: 'Electrical & RF Engineering',
    blurb:
      'Schematic capture and PCB design in Fusion 360, antenna design and characterization, WiFi/LTE/Bluetooth radio design and testing in L, S, and C band, and lab verification with network analyzers, spectrum analyzers, and oscilloscopes. I maintain a dedicated electronics and prototyping facility, including 3D printing for enclosures.',
    tools: 'Fusion 360 · Antenna design · VNA / spectrum analysis · LTspice',
  },
  {
    name: 'Systems Engineering (MBSE)',
    blurb:
      'Model-based systems engineering for complex products: requirements capture, SysML and UML architecture in MagicDraw, Cameo, and Papyrus, and reverse-engineering of existing C++ codebases into maintainable models. Experience architecting counter-drone and radar systems at the system-of-systems level.',
    tools: 'SysML · UML · Cameo / MagicDraw · Eclipse Papyrus · DOORS',
  },
  {
    name: 'Web, Cloud & DevOps',
    blurb:
      'Full websites and web apps — React, Next.js, Payload CMS, WordPress and e-commerce — deployed on AWS infrastructure you own, defined in Terraform and containerized with Docker. ECS/Fargate services, RDS, S3 + CloudFront delivery, CI/CD pipelines, and ongoing hosting and maintenance for small businesses. This site runs on that exact stack.',
    tools: 'Next.js · Payload CMS · AWS (ECS, RDS, S3, CloudFront) · Terraform · Docker',
  },
  {
    name: 'Machine Learning & Signal Processing',
    blurb:
      'Applied ML that ships: computer-vision detection models (custom YOLO architectures), speech-to-text pipelines on mobile-friendly models, time-series anomaly detection for predictive maintenance, and classical DSP — Fourier methods and statistical analysis for small-signal and radar applications.',
    tools: 'Python · TensorFlow / Keras · YOLO · Whisper · CUDA · Hugging Face',
  },
]

const engagements = [
  {
    name: 'Hourly',
    detail: 'Starting at $120/hr. Best for advisory work, debugging, and small, well-scoped tasks.',
  },
  {
    name: 'Retainer',
    detail:
      'A reserved block of hours each month. Best for ongoing maintenance, fractional-engineer support, and being on call when hardware misbehaves.',
  },
  {
    name: 'Fixed price',
    detail:
      'A quoted price against an agreed specification. Best for well-defined deliverables — a prototype, a website, a test fixture, a model.',
  },
]

export default function ServicesPage() {
  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '22px',
              fontWeight: 600,
              color: '#2C2C2A',
              marginBottom: '6px',
            }}
          >
            Services
          </h1>
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '14px',
              color: '#555',
              marginBottom: '32px',
              lineHeight: 1.6,
            }}
          >
            One technical partner from prototype to deployment. Engagements usually fall
            into one or more of the areas below — and projects that cross several of them
            are the ones this firm is built for.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '40px' }}>
            {services.map((service) => (
              <div key={service.name} style={{ backgroundColor: '#2C2C2A', padding: '16px 18px' }}>
                <div
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#ffffff',
                    marginBottom: '6px',
                  }}
                >
                  {service.name}
                </div>
                <p
                  style={{
                    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                    margin: '0 0 10px',
                  }}
                >
                  {service.blurb}
                </p>
                <div
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {service.tools}
                </div>
              </div>
            ))}
          </div>

          <h2
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '11px',
              fontWeight: 500,
              color: '#185FA5',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            How engagements work
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {engagements.map((eng) => (
              <p
                key={eng.name}
                style={{
                  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                  fontSize: '14px',
                  color: '#2C2C2A',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                <strong>{eng.name}.</strong> {eng.detail}
              </p>
            ))}
          </div>

          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '14px',
              color: '#2C2C2A',
              lineHeight: 1.6,
            }}
          >
            Not sure which fits?{' '}
            <a
              href="https://meet.consideratesystems.com/mark"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#185FA5', textDecoration: 'underline' }}
            >
              Schedule a free intro call
            </a>{' '}
            or send a note through the <a href="/contact" style={{ color: '#185FA5', textDecoration: 'underline' }}>contact form</a> — I reply within one business day.
          </p>
        </div>
      </div>
    </main>
  )
}
