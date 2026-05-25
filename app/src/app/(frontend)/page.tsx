import Image from 'next/image'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.photoWrap}>
          <Image
            src="/Mark.jpg"
            alt="Mark Musil"
            width={340}
            height={460}
            className={styles.photo}
            priority
          />
        </div>
        <div className={styles.intro}>
          <h1 className={styles.name}>Mark Musil</h1>
          <p className={styles.tagline}>Building things that matter.</p>
          <p className={styles.bio}>
            I work with small businesses and individuals to build thoughtful,
            effective solutions. Whether it&apos;s strategy, technology, or something
            in between — let&apos;s figure it out together.
          </p>
          <a href="mailto:mark.r.musil@gmail.com" className={styles.cta}>
            Get in touch
          </a>
        </div>
      </section>
    </main>
  )
}
