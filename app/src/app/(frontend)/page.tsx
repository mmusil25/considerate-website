import Image from 'next/image'
import { SiteHeader } from './components/SiteHeader'
import { NavMenu } from './components/NavMenu'

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <p
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#000000',
            maxWidth: '451px',
            margin: '0 auto 40px',
          }}
        >
          Considerate Systems LLC is a single member engineering consulting firm
          owned and operated by Mark Musil. I specialize in embedded systems,
          firmware, electrical engineering, web development, and DevOps — a
          complete technical partner from prototype to deployment.
          <br />
          <br />
          I maintain a dedicated electronics and prototyping facility for rapid
          development, and offer hourly, retainer, and fixed-price engagements
          to fit your project&apos;s scope. Hourly engagements typically start
          at $120/hr.
          <br />
          <br />
          Browse past work below (shared with permission), then schedule a
          meeting or reach out through the contact form.
        </p>

        <div style={{ margin: '0 auto 24px', width: 'fit-content' }}>
          <NavMenu />
        </div>

        <div style={{ width: '347px', margin: '0 auto' }}>
          <Image
            src="/Mark.jpg"
            alt="Mark Musil"
            width={347}
            height={520}
            sizes="347px"
            priority
            style={{ display: 'block', objectFit: 'cover' }}
          />
        </div>
      </div>
    </main>
  )
}
