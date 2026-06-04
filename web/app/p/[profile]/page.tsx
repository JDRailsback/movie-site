// Profile hub (PLAN §5 step 5). Placeholder until Phase 1 computes the taste
// profile; the import already persisted the user's films, so this confirms the
// hand-off and previews what's coming.

export default async function ProfileHub({
  params,
}: {
  params: Promise<{ profile: string }>;
}) {
  const { profile } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl font-semibold text-ink">
        Your taste profile is taking shape
      </h1>
      <p className="text-ink-soft">
        Your films are imported. The taste breakdown — genre and director affinities, eras,
        countries, and themes — arrives in Phase 1, followed by personalized recommendations.
      </p>
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
        {["Genre affinities", "Director rabbit holes", "Blind spots", "Hidden gems"].map(
          (label) => (
            <div
              key={label}
              className="rounded-card bg-cream-50 px-4 py-6 text-sm text-ink-soft shadow-sm"
            >
              {label}
              <div className="mt-2 h-2 w-full skeleton" />
            </div>
          ),
        )}
      </div>
      <p className="text-xs text-ink-soft">profile {profile}</p>
    </main>
  );
}
