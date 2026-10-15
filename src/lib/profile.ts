import type { StudentProfile } from '../types';
import { ACADEMIC_DATE } from './data';
type Field = keyof StudentProfile;
type Errors = Partial<Record<Field, string>>;

function ageToday(dateOfBirth: string) {
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  if (
    Number.isNaN(born.getTime()) ||
    born.getUTCFullYear() !== Number(dateOfBirth.slice(0, 4)) ||
    born.getUTCMonth() + 1 !== Number(dateOfBirth.slice(5, 7)) ||
    born.getUTCDate() !== Number(dateOfBirth.slice(8, 10))
  )
    return NaN;
  const today = ACADEMIC_DATE;
  const hadBirthday =
    today.getUTCMonth() * 100 + today.getUTCDate() >= born.getUTCMonth() * 100 + born.getUTCDate();
  return today.getUTCFullYear() - born.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

export const trimAll = (profile: StudentProfile) =>
  Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  ) as StudentProfile;

/** Returns { field: message } for every invalid field; {} means valid. */
export function validateStudentProfile(
  profile: StudentProfile,
  emailExists?: (email: string) => boolean,
) {
  const p = trimAll(profile);
  const digits = p.phone.replace(/\D/g, '').length;

  // [field, is invalid, message] — only the first failing rule per field is shown.
  const rules: [Field, boolean, string][] = [
    ['name', !p.name, 'Name is required.'],
    ['name', p.name.length > 120, 'Name must be 120 characters or fewer.'],
    [
      'preferredName',
      p.preferredName.length > 80,
      'Preferred name must be 80 characters or fewer.',
    ],
    ['email', !p.email, 'Email is required.'],
    ['email', p.email.length > 254, 'Email must be 254 characters or fewer.'],
    ['email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email), 'Enter a valid email address.'],
    ['email', Boolean(emailExists?.(p.email)), 'An account with this email already exists.'],
    [
      'dateOfBirth',
      Boolean(p.dateOfBirth) &&
        (Number.isNaN(ageToday(p.dateOfBirth)) || ageToday(p.dateOfBirth) < 0),
      'Enter a valid date of birth that is not in the future.',
    ],
    [
      'phone',
      Boolean(p.phone) && (digits < 7 || digits > 15 || !/^[+\d\s().-]+$/.test(p.phone)),
      'Enter a phone number with 7 to 15 digits.',
    ],
    ...(
      ['addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country'] as const
    ).map((field): [Field, boolean, string] => [
      field,
      p[field].length > 100,
      'Use 100 characters or fewer.',
    ]),
    [
      'genderIdentity',
      !['', 'woman', 'man', 'nonbinary', 'self-described', 'prefer-not-to-answer'].includes(
        p.genderIdentity,
      ),
      'Select a valid option.',
    ],
    [
      'ethnicity',
      !['', 'hispanic-or-latino', 'not-hispanic-or-latino', 'prefer-not-to-answer'].includes(
        p.ethnicity,
      ),
      'Select a valid option.',
    ],
    [
      'races',
      p.races.some(
        (r) =>
          ![
            'american-indian-or-alaska-native',
            'asian',
            'black-or-african-american',
            'native-hawaiian-or-pacific-islander',
            'white',
            'prefer-not-to-answer',
          ].includes(r),
      ) ||
        (p.races.includes('prefer-not-to-answer') && p.races.length > 1),
      'Choose valid options; prefer not to answer must be selected alone.',
    ],
    [
      'genderIdentityDetails',
      p.genderIdentity === 'self-described' && !p.genderIdentityDetails,
      'Please enter your gender identity.',
    ],
    [
      'genderIdentityDetails',
      p.genderIdentityDetails.length > 80,
      'Gender identity must be 80 characters or fewer.',
    ],
  ];

  const errors: Errors = {};
  for (const [field, invalid, message] of rules) if (invalid) errors[field] ??= message;
  return errors;
}
