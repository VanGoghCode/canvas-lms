import { useState } from 'react';
import type { Race, StudentProfile } from '../types';

export const MINIMUM_STUDENT_AGE = 16;

export const emptyStudentProfile: StudentProfile = {
  name: '',
  preferredName: '',
  email: '',
  dateOfBirth: '',
  phone: '',
  mailingAddress: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
  },
  demographics: {
    genderIdentity: '',
    genderIdentityDetails: '',
    ethnicity: '',
    races: [],
  },
};

type FieldName =
  | 'name'
  | 'preferredName'
  | 'email'
  | 'dateOfBirth'
  | 'phone'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'stateProvince'
  | 'postalCode'
  | 'country'
  | 'genderIdentity'
  | 'genderIdentityDetails'
  | 'ethnicity'
  | 'races';

type Errors = Partial<Record<FieldName, string>>;

interface StudentProfileFormProps {
  initialValue: StudentProfile;
  submitLabel: string;
  onSubmit: (profile: StudentProfile) => void;
  emailExists?: (email: string) => boolean;
}

const raceOptions: { value: Race; label: string }[] = [
  { value: 'american-indian-or-alaska-native', label: 'American Indian or Alaska Native' },
  { value: 'asian', label: 'Asian' },
  { value: 'black-or-african-american', label: 'Black or African American' },
  { value: 'native-hawaiian-or-pacific-islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'white', label: 'White' },
  { value: 'prefer-not-to-answer', label: 'Prefer not to answer' },
];

function required(value: string, label: string) {
  return value.trim() ? '' : `${label} is required.`;
}

function applicantAge(dateOfBirth: string) {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function maximumBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MINIMUM_STUDENT_AGE);
  return date.toISOString().slice(0, 10);
}

function validate(profile: StudentProfile, emailExists?: (email: string) => boolean): Errors {
  const errors: Errors = {};
  const { mailingAddress: address, demographics } = profile;

  if (!profile.name.trim()) errors.name = 'Full legal name is required.';
  else if (profile.name.trim().split(/\s+/).length < 2) errors.name = 'Enter your first and last name.';
  else if (profile.name.trim().length > 120) errors.name = 'Full legal name must be 120 characters or fewer.';

  if (profile.preferredName.trim().length > 80) errors.preferredName = 'Preferred name must be 80 characters or fewer.';

  if (!profile.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errors.email = 'Enter a valid email address.';
  else if (emailExists?.(profile.email.trim())) errors.email = 'An account with this email already exists.';

  if (!profile.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
  else if (Number.isNaN(new Date(`${profile.dateOfBirth}T00:00:00`).getTime())) errors.dateOfBirth = 'Enter a valid date of birth.';
  else if (applicantAge(profile.dateOfBirth) < MINIMUM_STUDENT_AGE) {
    errors.dateOfBirth = `Applicants must be at least ${MINIMUM_STUDENT_AGE} years old.`;
  }

  if (!profile.phone.trim()) errors.phone = 'Phone number is required.';
  else {
    const phoneDigits = profile.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15 || !/^[+\d\s().-]+$/.test(profile.phone.trim())) {
      errors.phone = 'Enter a valid phone number with 10 to 15 digits.';
    }
  }

  errors.addressLine1 = required(address.addressLine1, 'Street address');
  if (!errors.addressLine1 && address.addressLine1.trim().length < 5) errors.addressLine1 = 'Enter a complete street address.';
  if (address.addressLine2.trim().length > 100) errors.addressLine2 = 'Address line 2 must be 100 characters or fewer.';
  errors.city = required(address.city, 'City');
  errors.stateProvince = required(address.stateProvince, 'State or province');
  errors.postalCode = required(address.postalCode, 'Postal code');
  if (!errors.postalCode && !/^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/.test(address.postalCode.trim())) {
    errors.postalCode = 'Enter a valid postal code.';
  }
  errors.country = required(address.country, 'Country');

  errors.genderIdentity = required(demographics.genderIdentity, 'Gender identity');
  if (demographics.genderIdentity === 'self-described' && !demographics.genderIdentityDetails.trim()) {
    errors.genderIdentityDetails = 'Please enter your gender identity.';
  } else if (demographics.genderIdentityDetails.trim().length > 80) {
    errors.genderIdentityDetails = 'Gender identity must be 80 characters or fewer.';
  }
  errors.ethnicity = required(demographics.ethnicity, 'Ethnicity');
  if (demographics.races.length === 0) errors.races = 'Select at least one option.';

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as Errors;
}

export function StudentProfileForm({ initialValue, submitLabel, onSubmit, emailExists }: StudentProfileFormProps) {
  const [profile, setProfile] = useState<StudentProfile>(initialValue);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const updateField = (field: FieldName, value: string | Race[]) => {
    let next: StudentProfile;
    if (field in profile.mailingAddress) {
      next = { ...profile, mailingAddress: { ...profile.mailingAddress, [field]: value } };
    } else if (field in profile.demographics) {
      next = { ...profile, demographics: { ...profile.demographics, [field]: value } };
    } else {
      next = { ...profile, [field]: value };
    }
    setProfile(next);
    if (touched[field]) {
      const nextErrors = validate(next, emailExists);
      setErrors((currentErrors) => ({ ...currentErrors, [field]: nextErrors[field] }));
    }
  };

  const touchField = (field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
    const nextErrors = validate(profile, emailExists);
    setErrors((current) => ({ ...current, [field]: nextErrors[field] }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(profile, emailExists);
    setErrors(nextErrors);
    setTouched(Object.fromEntries(
      (Object.keys(nextErrors) as FieldName[]).map((field) => [field, true]),
    ));
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      ...profile,
      name: profile.name.trim(),
      preferredName: profile.preferredName.trim(),
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.trim(),
      mailingAddress: Object.fromEntries(
        Object.entries(profile.mailingAddress).map(([key, value]) => [key, value.trim()]),
      ) as StudentProfile['mailingAddress'],
      demographics: {
        ...profile.demographics,
        genderIdentityDetails: profile.demographics.genderIdentityDetails.trim(),
      },
    });
  };

  const errorProps = (field: FieldName) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
    onBlur: () => touchField(field),
  });

  const errorMessage = (field: FieldName) => errors[field]
    ? <span className="field-error" id={`${field}-error`} role="alert">{errors[field]}</span>
    : null;

  const toggleRace = (race: Race) => {
    const current = profile.demographics.races;
    let next: Race[];
    if (race === 'prefer-not-to-answer') {
      next = current.includes(race) ? [] : [race];
    } else {
      next = current.includes(race)
        ? current.filter((item) => item !== race)
        : [...current.filter((item) => item !== 'prefer-not-to-answer'), race];
    }
    updateField('races', next);
    setTouched((values) => ({ ...values, races: true }));
  };

  return (
    <form className="student-form" onSubmit={handleSubmit} noValidate>
      <section className="form-section" aria-labelledby="personal-heading">
        <div className="form-section-heading">
          <h2 id="personal-heading">Personal information</h2>
          <p>Your name and contact details for university records.</p>
        </div>
        <div className="form-grid">
          <label className="field field-wide" htmlFor="name">
            <span>Full legal name <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="name" autoComplete="name" required value={profile.name} onChange={(event) => updateField('name', event.target.value)} {...errorProps('name')} />
            {errorMessage('name')}
          </label>
          <label className="field" htmlFor="preferredName">
            <span>Preferred name <span className="optional-label">Optional</span></span>
            <input id="preferredName" autoComplete="nickname" value={profile.preferredName} onChange={(event) => updateField('preferredName', event.target.value)} {...errorProps('preferredName')} />
            {errorMessage('preferredName')}
          </label>
          <label className="field" htmlFor="dateOfBirth">
            <span>Date of birth <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="dateOfBirth" type="date" autoComplete="bday" max={maximumBirthDate()} required value={profile.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} {...errorProps('dateOfBirth')} />
            <span className="field-hint">Applicants must be at least {MINIMUM_STUDENT_AGE} years old.</span>
            {errorMessage('dateOfBirth')}
          </label>
          <label className="field" htmlFor="email">
            <span>Email address <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="email" type="email" autoComplete="email" required value={profile.email} onChange={(event) => updateField('email', event.target.value)} {...errorProps('email')} />
            {errorMessage('email')}
          </label>
          <label className="field" htmlFor="phone">
            <span>Phone number <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="phone" type="tel" autoComplete="tel" placeholder="(555) 555-0123" required value={profile.phone} onChange={(event) => updateField('phone', event.target.value)} {...errorProps('phone')} />
            {errorMessage('phone')}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="address-heading">
        <div className="form-section-heading">
          <h2 id="address-heading">Mailing address</h2>
          <p>Use an address where you can receive official correspondence.</p>
        </div>
        <div className="form-grid">
          <label className="field field-wide" htmlFor="addressLine1">
            <span>Street address <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="addressLine1" autoComplete="address-line1" required value={profile.mailingAddress.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} {...errorProps('addressLine1')} />
            {errorMessage('addressLine1')}
          </label>
          <label className="field field-wide" htmlFor="addressLine2">
            <span>Apartment, suite, or unit <span className="optional-label">Optional</span></span>
            <input id="addressLine2" autoComplete="address-line2" value={profile.mailingAddress.addressLine2} onChange={(event) => updateField('addressLine2', event.target.value)} {...errorProps('addressLine2')} />
            {errorMessage('addressLine2')}
          </label>
          <label className="field" htmlFor="city">
            <span>City <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="city" autoComplete="address-level2" required value={profile.mailingAddress.city} onChange={(event) => updateField('city', event.target.value)} {...errorProps('city')} />
            {errorMessage('city')}
          </label>
          <label className="field" htmlFor="stateProvince">
            <span>State or province <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="stateProvince" autoComplete="address-level1" required value={profile.mailingAddress.stateProvince} onChange={(event) => updateField('stateProvince', event.target.value)} {...errorProps('stateProvince')} />
            {errorMessage('stateProvince')}
          </label>
          <label className="field" htmlFor="postalCode">
            <span>Postal code <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="postalCode" autoComplete="postal-code" required value={profile.mailingAddress.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} {...errorProps('postalCode')} />
            {errorMessage('postalCode')}
          </label>
          <label className="field" htmlFor="country">
            <span>Country <span className="required-mark" aria-hidden="true">*</span></span>
            <input id="country" autoComplete="country-name" required value={profile.mailingAddress.country} onChange={(event) => updateField('country', event.target.value)} {...errorProps('country')} />
            {errorMessage('country')}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="demographics-heading">
        <div className="form-section-heading">
          <h2 id="demographics-heading">Demographic information</h2>
          <p>Used only for institutional and government reporting. “Prefer not to answer” is available for every question.</p>
        </div>
        <div className="form-grid">
          <label className="field" htmlFor="genderIdentity">
            <span>Gender identity <span className="required-mark" aria-hidden="true">*</span></span>
            <select id="genderIdentity" required value={profile.demographics.genderIdentity} onChange={(event) => updateField('genderIdentity', event.target.value)} {...errorProps('genderIdentity')}>
              <option value="">Select an option</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="nonbinary">Nonbinary</option>
              <option value="self-described">Self-describe</option>
              <option value="prefer-not-to-answer">Prefer not to answer</option>
            </select>
            {errorMessage('genderIdentity')}
          </label>
          {profile.demographics.genderIdentity === 'self-described' && (
            <label className="field" htmlFor="genderIdentityDetails">
              <span>Gender identity description <span className="required-mark" aria-hidden="true">*</span></span>
              <input id="genderIdentityDetails" required value={profile.demographics.genderIdentityDetails} onChange={(event) => updateField('genderIdentityDetails', event.target.value)} {...errorProps('genderIdentityDetails')} />
              {errorMessage('genderIdentityDetails')}
            </label>
          )}
          <label className="field" htmlFor="ethnicity">
            <span>Ethnicity <span className="required-mark" aria-hidden="true">*</span></span>
            <select id="ethnicity" required value={profile.demographics.ethnicity} onChange={(event) => updateField('ethnicity', event.target.value)} {...errorProps('ethnicity')}>
              <option value="">Select an option</option>
              <option value="hispanic-or-latino">Hispanic or Latino</option>
              <option value="not-hispanic-or-latino">Not Hispanic or Latino</option>
              <option value="prefer-not-to-answer">Prefer not to answer</option>
            </select>
            {errorMessage('ethnicity')}
          </label>
          <fieldset className="field checkbox-field field-wide" aria-required="true" aria-describedby={errors.races ? 'races-error' : undefined}>
            <legend>Race (select all that apply) <span className="required-mark" aria-hidden="true">*</span></legend>
            <div className="checkbox-grid">
              {raceOptions.map((option) => (
                <label key={option.value}>
                  <input type="checkbox" checked={profile.demographics.races.includes(option.value)} onChange={() => toggleRace(option.value)} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {errorMessage('races')}
          </fieldset>
        </div>
      </section>

      <div className="form-actions">
        <button className="button button-primary" type="submit">{submitLabel}</button>
        <span className="required-note"><span className="required-mark" aria-hidden="true">*</span> Required field</span>
      </div>
    </form>
  );
}
