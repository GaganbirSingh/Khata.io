import { Link } from 'react-router';

// Two separate, unticked boxes: agreeing is a clear action and nothing is pre-selected.
export default function ConsentChecks({ values, onChange, errors = {} }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
      <legend className="sr-only">Agreements</legend>
      <div className="check">
        <input
          id="ageConfirmed"
          type="checkbox"
          checked={values.ageConfirmed}
          onChange={(e) => onChange({ ...values, ageConfirmed: e.target.checked })}
          aria-invalid={errors.ageConfirmed ? 'true' : undefined}
          aria-describedby={errors.ageConfirmed ? 'ageConfirmed-error' : undefined}
        />
        <label htmlFor="ageConfirmed">I am 18 years or older.</label>
      </div>
      {errors.ageConfirmed && (
        <span id="ageConfirmed-error" className="error" style={{ color: 'var(--danger)', display: 'block', marginTop: -6, marginBottom: 8 }}>
          {errors.ageConfirmed}
        </span>
      )}
      <div className="check">
        <input
          id="acceptTerms"
          type="checkbox"
          checked={values.acceptTerms}
          onChange={(e) => onChange({ ...values, acceptTerms: e.target.checked })}
          aria-invalid={errors.acceptTerms ? 'true' : undefined}
          aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
        />
        <label htmlFor="acceptTerms">
          I have read and agree to the{' '}
          <Link to="/terms" target="_blank" rel="noopener">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link to="/privacy" target="_blank" rel="noopener">
            Privacy Policy
          </Link>
          <span className="sr-only"> (open in a new tab)</span>.
        </label>
      </div>
      {errors.acceptTerms && (
        <span id="acceptTerms-error" className="error" style={{ color: 'var(--danger)', display: 'block', marginTop: -6, marginBottom: 8 }}>
          {errors.acceptTerms}
        </span>
      )}
    </fieldset>
  );
}
