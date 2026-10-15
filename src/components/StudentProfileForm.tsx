import { InfoButton } from './InfoButton';
// Shared by Register (new student) and Profile (edit student).
import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { StudentProfile } from '../types';
import { ACADEMIC_DATE } from '../lib/data';
import { trimAll, validateStudentProfile } from '../lib/profile';

type Field = keyof StudentProfile;

const PREFER_NOT = 'prefer-not-to-answer';
const GENDERS = [
  ['woman', 'Woman'],
  ['man', 'Man'],
  ['nonbinary', 'Nonbinary'],
  ['self-described', 'Self-describe'],
  [PREFER_NOT, 'Prefer not to answer'],
];
const ETHNICITIES = [
  ['hispanic-or-latino', 'Hispanic or Latino'],
  ['not-hispanic-or-latino', 'Not Hispanic or Latino'],
  [PREFER_NOT, 'Prefer not to answer'],
];
const RACES = [
  ['american-indian-or-alaska-native', 'American Indian or Alaska Native'],
  ['asian', 'Asian'],
  ['black-or-african-american', 'Black or African American'],
  ['native-hawaiian-or-pacific-islander', 'Native Hawaiian or Other Pacific Islander'],
  ['white', 'White'],
  [PREFER_NOT, 'Prefer not to answer'],
];

interface Props {
  initialValue: StudentProfile;
  submitLabel: string;
  onSubmit: (profile: StudentProfile) => string | null;
  onChange?: () => void;
  emailExists?: (email: string) => boolean;
}

export function StudentProfileForm({
  initialValue,
  submitLabel,
  onSubmit,
  emailExists,
  onChange,
}: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profile, setProfile] = useState(initialValue);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const errors = validateStudentProfile(profile, emailExists);
  const shownError = (name: Field) => touched[name] && errors[name];

  const set = (name: Field, value: string | string[]) => {
    onChange?.();
    setSaveError(null);
    setProfile((current) => ({ ...current, [name]: value }));
  };
  const touch = (name: Field) => setTouched((current) => ({ ...current, [name]: true }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(Object.fromEntries(Object.keys(profile).map((key) => [key, true])));
    if (Object.keys(errors).length) {
      const field = document.getElementById(Object.keys(errors)[0]);
      const details = field?.closest('details');
      if (details) details.open = true;
      field?.focus();
      return;
    }
    const trimmed = trimAll(profile);
    setSaveError(
      onSubmit({
        ...trimmed,
        email: trimmed.email.toLowerCase(),
        genderIdentityDetails:
          trimmed.genderIdentity === 'self-described' ? trimmed.genderIdentityDetails : '',
      }),
    );
  };

  // "Prefer not to answer" can't be combined with other races.
  const toggleRace = (race: string) => {
    const others = profile.races.filter((r) => r !== race && r !== PREFER_NOT);
    const next = profile.races.includes(race)
      ? profile.races.filter((r) => r !== race)
      : race === PREFER_NOT
        ? [race]
        : [...others, race];
    set('races', next);
    touch('races');
  };

  const errorText = (name: Field) =>
    shownError(name) && (
      <span className="error" id={`${name}-error`} role="alert">
        {errors[name]}
      </span>
    );

  const field = (
    name: Exclude<Field, 'races'>,
    label: string,
    options: {
      optional?: boolean;
      wide?: boolean;
      type?: string;
      autoComplete?: string;
      max?: string;
      hint?: string;
      choices?: string[][];
    } = {},
  ) => {
    const { optional: explicitOptional, wide, hint, choices, ...inputProps } = options;
    const optional =
      explicitOptional ?? (name !== 'name' && name !== 'email' && name !== 'genderIdentityDetails');
    const props = {
      id: name,
      value: profile[name],
      required: !optional,
      'aria-invalid': Boolean(shownError(name)),
      'aria-describedby': shownError(name) ? `${name}-error` : undefined,
      onBlur: () => touch(name),
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(name, e.target.value),
    };
    return (
      <label className={wide ? 'wide' : ''} htmlFor={name}>
        <span>
          {label}{' '}
          {optional ? (
            <small className="muted">Optional</small>
          ) : (
            <span className="required">*</span>
          )}
        </span>
        {choices ? (
          <select {...props}>
            <option value="">Select an option</option>
            {choices.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        ) : (
          <input {...inputProps} {...props} />
        )}
        {hint && <small className="muted">{hint}</small>}
        {errorText(name)}
      </label>
    );
  };

  const latestBirthDate = ACADEMIC_DATE;

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <section className="card">
        <h2>Personal information</h2>
        <div className="form-grid">
          {field('name', 'Full name', { wide: true, autoComplete: 'name' })}
          {field('preferredName', 'Preferred name', { optional: true, autoComplete: 'nickname' })}
          {field('dateOfBirth', 'Date of birth', {
            type: 'date',
            autoComplete: 'bday',
            max: latestBirthDate.toISOString().slice(0, 10),
          })}
          {field('email', 'Email address', { type: 'email', autoComplete: 'email' })}
          {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel' })}
        </div>
      </section>

      <details className="card">
        <summary>
          Mailing address <small className="muted">Optional</small>
        </summary>
        <div className="form-grid">
          {field('addressLine1', 'Street address', { wide: true, autoComplete: 'address-line1' })}
          {field('addressLine2', 'Apartment, suite, or unit', {
            wide: true,
            optional: true,
            autoComplete: 'address-line2',
          })}
          {field('city', 'City', { autoComplete: 'address-level2' })}
          {field('stateProvince', 'State or province', { autoComplete: 'address-level1' })}
          {field('postalCode', 'Postal code', { autoComplete: 'postal-code' })}
          {field('country', 'Country', { autoComplete: 'country-name' })}
        </div>
      </details>

      <details className="card">
        <summary>
          Demographic information <small className="muted">Optional</small>
        </summary>
        <p className="muted">
          Optional · use fictional information.{' '}
          <InfoButton title="Demographic information">
            <p>
              These details do not affect course access, grades, support flags, or recommendations.
              Instructors do not see these fields in the course roster.
            </p>
          </InfoButton>
        </p>
        <div className="form-grid">
          {field('genderIdentity', 'Gender identity', { choices: GENDERS })}
          {profile.genderIdentity === 'self-described' &&
            field('genderIdentityDetails', 'Gender identity description')}
          {field('ethnicity', 'Ethnicity', { choices: ETHNICITIES })}
          <fieldset
            className="wide"
            aria-describedby={shownError('races') ? 'races-error' : undefined}
          >
            <legend>
              Race (select all that apply) <small className="muted">Optional</small>
            </legend>
            <div className="form-grid">
              {RACES.map(([value, text]) => (
                <label className="checkbox" key={value}>
                  <input
                    type="checkbox"
                    checked={profile.races.includes(value)}
                    onChange={() => toggleRace(value)}
                  />
                  {text}
                </label>
              ))}
            </div>
            {errorText('races')}
          </fieldset>
        </div>
      </details>

      {saveError && (
        <p className="error" role="alert">
          {saveError}
        </p>
      )}
      <div className="actions">
        <button className="button primary" type="submit">
          {submitLabel}
        </button>
        <span className="muted">
          <span className="required">*</span> Required field
        </span>
      </div>
    </form>
  );
}
