/** Home page section identifiers: static ones plus dynamic `sc:{id}` SoundCloud rails. */
export interface HomeSectionRef {
  id: string
}

/**
 * Applies the user's home customization: drops hidden sections and sorts by the
 * saved top-to-bottom order. Sections not present in `order` (e.g. new SoundCloud
 * rails) keep their natural relative order after the ordered ones.
 */
export function orderHomeSections<T extends HomeSectionRef>(
  sections: T[],
  order: string[],
  hidden: string[]
): T[] {
  const hiddenSet = new Set(hidden)
  const visible = sections.filter((section) => !hiddenSet.has(section.id))
  if (order.length === 0) return visible
  const position = new Map(order.map((id, index) => [id, index]))
  const listed = visible
    .filter((section) => position.has(section.id))
    .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
  const unlisted = visible.filter((section) => !position.has(section.id))
  return [...listed, ...unlisted]
}
