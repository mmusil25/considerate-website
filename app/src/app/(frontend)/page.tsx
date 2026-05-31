import Image from 'next/image'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <section className="flex items-center gap-16 max-w-4xl w-full sm:flex-row flex-col sm:text-left text-center">
        <div className="shrink-0">
          <Image
            src="/Mark.jpg"
            alt="Mark Musil"
            width={340}
            height={460}
            className="rounded-2xl object-cover shadow-2xl"
            priority
          />
        </div>
        <div className="flex-1">
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-2 sm:text-5xl text-4xl">
            Mark Musil
          </h1>
          <p className="text-xl text-gray-500 mb-6">
            Building things that matter.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-md sm:mx-0 mx-auto">
            I work with small businesses and individuals to build thoughtful,
            effective solutions. Whether it&apos;s strategy, technology, or something
            in between — let&apos;s figure it out together.
          </p>
          <a
            href="mailto:mark.r.musil@gmail.com"
            className="inline-block bg-gray-900 text-white px-8 py-3 rounded-lg font-medium transition-colors hover:bg-gray-700"
          >
            Get in touch
          </a>
        </div>
      </section>
    </main>
  )
}
