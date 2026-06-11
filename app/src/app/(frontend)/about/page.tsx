import type { Metadata } from 'next'
import { SiteHeader } from '../components/SiteHeader'

export const metadata: Metadata = {
  title: 'About Mark Musil — Considerate Systems LLC',
  description:
    'Electrical engineer and founder of Considerate Systems LLC. A decade across embedded systems, RF, model-based systems engineering, machine learning, and cloud infrastructure.',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "'Work Sans', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  color: '#185FA5',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  margin: '36px 0 14px',
}

const bodyText: React.CSSProperties = {
  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
  fontSize: '14px',
  color: '#2C2C2A',
  lineHeight: 1.65,
  margin: '0 0 14px',
}

type Role = {
  title: string
  org: string
  period: string
  summary: string
}

const roles: Role[] = [
  {
    title: 'Founder & Engineering Consultant',
    org: 'Considerate Systems LLC',
    period: '2025 — present',
    summary:
      'Engineering consultancy covering embedded systems, firmware, RF, web development, and DevOps. Model-based systems engineering (UML/SysML) contract work, project management, and development roadmapping for clients from startups to small businesses.',
  },
  {
    title: 'Embedded Systems Engineer',
    org: 'Armada Power',
    period: '2024 — 2025',
    summary:
      'C++ embedded Linux development for fleets of IoT smart water heaters: OpenWRT-based OS design with real-time MQTT messaging, time-series anomaly detection for predictive maintenance, SysML modeling of the switching fleet, component-level PCB design in Fusion 360, and WiFi/LTE/Bluetooth RF design and testing in L, S, and C band.',
  },
  {
    title: 'Freelance Engineer',
    org: 'Upwork',
    period: '2023 — present',
    summary:
      'WordPress builds for small businesses, 3D-printed prototype enclosures in Fusion 360, Raspberry Pi prototyping for startups, and statistical/spectral analysis (Python, Fourier methods) for small-signal and radar applications.',
  },
  {
    title: 'Software Engineer',
    org: 'ECS Federal',
    period: '2023',
    summary:
      'Radar systems software: C# with Modbus TCP for real-time hardware coordination over Ethernet, LabVIEW hardware-control GUIs, C++ data processing, and GitLab CI/CD architecture deployed on AWS ECS.',
  },
  {
    title: 'Systems Engineer',
    org: 'ManTech',
    period: '2020 — 2022',
    summary:
      'Architected large-scale counter-drone systems using MBSE and SysML in MagicDraw and Cameo. C++ drivers and GUIs plus Python/LabVIEW/MATLAB signal-processing for radar; designed and characterized RF systems in a system-of-systems context.',
  },
  {
    title: 'Lead Engineer',
    org: 'Sawback Technologies',
    period: '2020 — 2021',
    summary:
      'Led development of a ground-penetrating radar system: PetaLinux on Xilinx SoC/FPGA, Zynq7000 embedded C for SPI data acquisition and control, UHF analog circuit design, and lab debug with logic analyzers, spectrum analyzers, and oscilloscopes. Translated system-level engineering into investor-facing status reports.',
  },
  {
    title: 'Software & Machine Learning Engineer (Internships)',
    org: 'Intel Corporation',
    period: '2019 — 2020',
    summary:
      'Built a DNN computer-vision wafer-defect detection tool that reduced validation time on a silicon assembly line, scripted automated neural-architecture search, and developed Python data-analysis GUIs for TEM metrology.',
  },
  {
    title: 'Product Validation Engineer (Internship)',
    org: 'Stevens Water Monitoring Systems',
    period: '2019 — 2020',
    summary:
      'Automated test-equipment software for embedded environmental sensors: a five-stage continuous-delivery test suite covering SDI-12 and RS-485 firmware interfaces, deployed uniformly across Linux machines with bash and Docker.',
  },
  {
    title: 'Reliability Researcher (Internship)',
    org: 'IRT Saint-Exupéry — Toulouse, France',
    period: '2018',
    summary:
      'Cut chip reliability testing from ~10,000 hours to ~500 by formalizing a failure-in-time prediction methodology for deep sub-micron devices, prototyped in VHDL on a Xilinx UltraScale+ FPGA. Published at IEEE NMDC 2018.',
  },
]

const publications = [
  {
    title:
      'Synopsis of Multiphysics Deep Sub-Micron Failure Rate Modeling Technique for CFR and EOL Prediction',
    venue: 'IEEE Nanotechnology Materials and Devices Conference (NMDC), 2018',
    href: 'https://doi.org/10.1109/NMDC.2018.8605877',
  },
  {
    title: 'A Dendritic Transfer Function in a Novel Fully Connected Layer',
    venue: "Undergraduate Honor's Thesis, Portland State University, 2019",
    href: 'http://archives.pdx.edu/ds/psu/28835',
  },
  {
    title: 'Combining Algorithms for More General AI',
    venue: 'Undergraduate research and mentoring program, 2018',
    href: 'http://archives.pdx.edu/ds/psu/25180',
  },
]

const links = [
  { label: 'GitHub', href: 'https://github.com/mmusil25' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mark-musil/' },
  { label: 'Personal site', href: 'https://markmusil.click' },
  { label: 'YouTube', href: 'https://www.youtube.com/channel/UCIOyt8pagGZikOUHNcfIdQA' },
]

export default function AboutPage() {
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
            About Mark
          </h1>

          <p style={bodyText}>
            I&apos;m an electrical engineer based in Columbus, Ohio, and the founder of
            Considerate Systems LLC. Over the past decade I&apos;ve worked across the full
            stack of hardware and software — from antenna design and FPGA firmware to
            machine learning pipelines and cloud infrastructure — for employers and
            clients ranging from defense contractors to one-person businesses.
          </p>
          <p style={bodyText}>
            That breadth is the point. Small and mid-sized organizations rarely need five
            specialists; they need one engineer who can carry an idea from a SysML
            architecture diagram through a working prototype to a deployed, maintained
            product. That is the service this firm exists to provide.
          </p>

          <h2 style={sectionLabel}>Experience</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {roles.map((role) => (
              <div key={`${role.org}-${role.period}`} style={{ backgroundColor: '#2C2C2A', padding: '14px 18px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Work Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#ffffff',
                    }}
                  >
                    {role.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Work Sans', sans-serif",
                      fontSize: '11px',
                      color: '#8f9da3',
                      flexShrink: 0,
                    }}
                  >
                    {role.period}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.45)',
                    marginBottom: '6px',
                  }}
                >
                  {role.org}
                </div>
                <p
                  style={{
                    fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {role.summary}
                </p>
              </div>
            ))}
          </div>

          <h2 style={sectionLabel}>Education & Certifications</h2>
          <p style={{ ...bodyText, marginBottom: '8px' }}>
            <strong>BS Electrical Engineering</strong> — Portland State University,
            2015–2020 (GPA 3.89). Led the Engineers Without Borders Ethiopian Solar
            Initiative, designing a 3&nbsp;kW grid-tied solar system for a school in
            Ethiopia, and built satellite ground-station hardware with the CubeSat team.
          </p>
          <p style={{ ...bodyText, marginBottom: '8px' }}>
            <strong>AWS Certified Cloud Practitioner</strong> — Amazon Web Services.
          </p>
          <p style={bodyText}>
            <strong>Electronics Technician Certificate</strong> — Eastland-Fairfield
            Technical School, 2011–2013.
          </p>

          <h2 style={sectionLabel}>Publications</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {publications.map((pub) => (
              <p key={pub.href} style={{ ...bodyText, margin: 0 }}>
                <a
                  href={pub.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#185FA5', textDecoration: 'underline' }}
                >
                  {pub.title}
                </a>
                <br />
                <span style={{ fontSize: '12px', color: '#555' }}>{pub.venue}</span>
              </p>
            ))}
          </div>

          <h2 style={sectionLabel}>Elsewhere</h2>
          <p style={bodyText}>
            {links.map((link, i) => (
              <span key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#185FA5', textDecoration: 'underline' }}
                >
                  {link.label}
                </a>
                {i < links.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <p style={bodyText}>
            I work in English and French.
          </p>
        </div>
      </div>
    </main>
  )
}
