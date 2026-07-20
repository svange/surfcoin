import { SectionHeading } from './SectionHeading'

const FAQS = [
  {
    q: 'Is $SURF a good investment?',
    a: "$SURF is a beach towel with a ticker symbol. It is not an investment. It's a vibe with a hard supply cap. Expect nothing and the sunset will occasionally over-deliver.",
  },
  {
    q: 'Why is the domain .fail?',
    a: 'Because roughly 97% of memecoins go to zero, and we figured at least one of us should dress for the occasion. If we make it, the domain becomes ironic. If we don’t, it becomes documentation. Either way it was $4.',
  },
  {
    q: 'Wen CA?',
    a: 'At launch, on this page, in the big obvious box. Anyone offering you an early CA is a riptide in a hoodie. Swim parallel to shore and block them.',
  },
  {
    q: "What's the utility?",
    a: 'None. It floats. And there’s the sunset: free, daily, non-custodial, 100% uptime for 4.5 billion years. Show us another protocol with that track record.',
  },
  {
    q: 'Wen lambo?',
    a: 'Lambos are terrible on sand — we covered this in the lore. The team maintains a fleet of bicycles.',
  },
  {
    q: "Who's the team?",
    a: 'A rotating cast of people who should be outside more, led spiritually by a man named Dale, who may not exist.',
  },
  {
    q: 'Wen moon?',
    a: 'The moon controls the tides. We are, in a strict oceanographic sense, already moon-powered. Next question.',
  },
  {
    q: 'Is any of this financial advice?',
    a: 'The lifeguard chair is empty. Swim at your own risk. (No.)',
  },
]

export function Lifeguard() {
  return (
    <section id="lifeguard" className="bg-salt px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <SectionHeading kicker="frequently asked, patiently answered">
          Ask the Lifeguard
        </SectionHeading>
        <div className="divide-y divide-driftwood/15 border-y border-driftwood/15">
          {FAQS.map(faq => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-driftwood transition-colors hover:text-burnt [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="text-coral transition-transform duration-200 group-open:rotate-45"
                >
                  ＋
                </span>
              </summary>
              <p className="mt-3 pr-8 text-driftwood/90">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
