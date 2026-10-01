// The price as a ticket (plan 171): the fare on the left -- what it
// is, the figure, how it is billed -- and on its stub, torn along a
// perforation, the one number that sells it. The only gold a screen
// carries besides its gate: the offer is what gets the attention.
export function OfferTicket({ kind, price, unit, bill, save, cap }) {
  return (
    <div className="ofr-tkt">
      <div className="ofr-tkt__main">
        <span className="ofr-tkt__kind">{kind}</span>
        <span className="ofr-tkt__price">
          {price}
          {unit && <span className="ofr-tkt__unit">{unit}</span>}
        </span>
        <span className="ofr-tkt__bill">{bill}</span>
      </div>
      <div className="ofr-tkt__stub">
        <span className="ofr-tkt__save">{save}</span>
        <span className="ofr-tkt__cap">{cap}</span>
      </div>
    </div>
  )
}
