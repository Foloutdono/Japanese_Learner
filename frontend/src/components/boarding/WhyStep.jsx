import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { MOTIVES } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption } from './BoardOption'
import { MotiveIcon } from './icons'

// ── 2 · why (plan 075) ───────────────────────────────────────────
// Six rows, one choice; the plan's two promise lines come from it.
export default function WhyStep({ name, value, onChange, onContinue }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>
          <Emphasized text={t.brdWhyQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage">
          <div className="brd__opts">
            {MOTIVES.map(m => (
              <BoardOption
                key={m}
                on={value === m}
                onClick={() => onChange(m)}
                icon={<MotiveIcon motive={m} />}
                label={t.brdMotive[m]}
                data-motive={m}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}
