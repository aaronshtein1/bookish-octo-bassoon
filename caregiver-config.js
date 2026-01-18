/**
 * Caregiver Onboarding Configuration
 * Maps Monday.com board fields to HHA Exchange fields
 */

export const CAREGIVER_CONFIG = {
  // Monday.com Board Configuration
  monday: {
    boardId: '6119848729', // HHA/PCA Hiring board
    statusColumnId: 'status',
    readyStatusValue: 'Active', // When status = Active, enter into HHA Exchange
    completedStatusValue: 'Entered in HHA Exchange', // Update to this after entry

    // Map Monday.com column IDs to caregiver fields
    columnMapping: {
      'text8': 'applicantName',      // Applicant Name
      'email': 'email',               // Email
      'phone': 'phone',               // Phone
      'date7': 'dateOfBirth',         // Date of Birth
      'text1': 'ssn',                 // SSN #
      'text19': 'registryNumber',     // Registry #
      'dropdown4': 'certificationType', // Certification Declared (HHA/PCA)
      'languages_spoken': 'languages', // Languages Spoken
      'preferred_locations': 'preferredLocations', // Preferred Locations
      'dropdown__1': 'hasCar',        // Car (Yes/No)
      'dropdown6': 'availability',    // Availability
      'dropdown2': 'preferredShift',  // Preferred Shift
    }
  },

  // HHA Exchange Field Configuration
  // This defines where and how to enter data in HHA Exchange
  hhaExchange: {
    // Main navigation path to add new caregiver
    navigationPath: {
      menu: 'Caregiver',           // Main menu item in nav bar
      submenu: 'New Caregiver'     // Dropdown menu option
    },

    // Field mappings for HHA Exchange form (based on actual form screenshots)
    fields: {
      // PRIMARY OFFICE - Dropdown (AHS-Albany visible in screenshot)
      // NOTE: This uses zmultiselect custom widget - making optional for now
      primaryOffice: {
        selector: 'select[name*="Office" i], select[id*="Office" i]',
        required: false,  // Changed to false because it uses custom zmultiselect widget
        source: 'preferredLocations',
        type: 'dropdown',
        defaultValue: 'AHS-Albany'
      },

      // CAREGIVER TYPE - Dropdown - Employee
      caregiverType: {
        selector: 'select[name*="Type" i], select[id*="CaregiverType" i]',
        required: true,
        type: 'dropdown',
        fixedValue: 'Employee'
      },

      // FIRST NAME - Text Input
      firstName: {
        selector: 'input[name*="FirstName" i], input[id*="FirstName" i], label:has-text("First Name") + input',
        required: true,
        source: 'applicantName',
        transform: (name) => name.trim().split(' ')[0]
      },

      // LAST NAME - Text Input
      lastName: {
        selector: 'input[name*="LastName" i], input[id*="LastName" i], label:has-text("Last Name") + input',
        required: true,
        source: 'applicantName',
        transform: (name) => {
          const parts = name.trim().split(' ');
          return parts.slice(1).join(' ') || parts[0];
        }
      },

      // MIDDLE NAME - Text Input (optional)
      middleName: {
        selector: 'input[name*="MiddleName" i], input[id*="MiddleName" i]',
        required: false,
        source: null
      },

      // GENDER - Dropdown
      gender: {
        selector: 'select[name*="Gender" i], select[id*="Gender" i]',
        required: false,
        type: 'dropdown',
        fixedValue: 'Female' // Default, can be changed
      },

      // INITIALS - Text Input
      initials: {
        selector: 'input[name*="Initials" i], input[id*="Initials" i]',
        required: false,
        source: 'applicantName',
        transform: (name) => {
          const parts = name.trim().split(' ');
          return parts.map(p => p[0]).join('').toUpperCase().substring(0, 3);
        }
      },

      // DATE OF BIRTH - Date Input (format: mm/dd/yyyy)
      dateOfBirth: {
        selector: 'input[name*="Birth" i], input[id*="Birth" i], input[type="date"]',
        required: true,
        source: 'dateOfBirth',
        type: 'date',
        transform: (date) => {
          if (date && date.includes('-')) {
            const [year, month, day] = date.split('-');
            return `${month}/${day}/${year}`;
          }
          return date;
        }
      },

      // SOCIAL SECURITY NUMBER - Text Input
      ssn: {
        selector: 'input[name*="SSN" i], input[id*="SSN" i], input[name*="Social" i]',
        required: false,
        source: 'ssn',
        transform: (ssn) => ssn ? ssn.replace(/\D/g, '') : ''
      },

      // ALT. CAREGIVER CODE - Text Input (optional)
      altCaregiverCode: {
        selector: 'input[name*="CaregiverCode" i], input[id*="AltCode" i]',
        required: false,
        source: null
      },

      // STATUS - Dropdown - Active
      status: {
        selector: 'select[name*="Status" i]:not([name*="Marital" i]), select[id*="Status" i]:not([id*="Marital" i])',
        required: true,
        type: 'dropdown',
        fixedValue: 'Active'
      },

      // EMPLOYMENT TYPE - Checkboxes (PCA, HHA, etc.)
      // Note: This is a checkbox group, not a single field
      employmentTypePCA: {
        selector: 'input[type="checkbox"][value="PCA"], input[type="checkbox"][id*="PCA" i]',
        required: false,
        source: 'certificationType',
        type: 'checkbox',
        transform: (certType) => certType && certType.toLowerCase().includes('pca')
      },

      employmentTypeHHA: {
        selector: 'input[type="checkbox"][value="HHA"], input[type="checkbox"][id*="HHA" i]',
        required: false,
        source: 'certificationType',
        type: 'checkbox',
        transform: (certType) => certType && certType.toLowerCase().includes('hha')
      },

      // REFERRAL SOURCE - Dropdown (showing "Indeed.com" in screenshot)
      referralSource: {
        selector: 'select[name*="Referral" i], select[id*="ReferralSource" i]',
        required: false,
        type: 'dropdown',
        fixedValue: 'Indeed.com'
      },

      // TEAM - Dropdown
      team: {
        selector: 'select[name*="Team" i], select[id*="Team" i]',
        required: false,
        source: 'preferredLocations',
        type: 'dropdown'
      },

      // LOCATION - Dropdown (showing "Albany" in screenshot)
      location: {
        selector: 'select[name*="Location" i], select[id*="Location" i]',
        required: true,
        source: 'preferredLocations',
        type: 'dropdown',
        defaultValue: 'Albany'
      },

      // BRANCH - Dropdown (showing "Albany (Licensed)" in screenshot)
      branch: {
        selector: 'select[name*="Branch" i], select[id*="Branch" i]',
        required: true,
        source: 'preferredLocations',
        type: 'dropdown',
        defaultValue: 'Albany (Licensed)'
      },

      // ADDRESS LINE 1 - Text Input
      addressLine1: {
        selector: 'input[name*="Address" i][name*="1" i], input[id*="AddressLine1" i], input[id*="Address1" i]',
        required: false,
        source: 'address1'
      },

      // ADDRESS LINE 2 - Text Input
      addressLine2: {
        selector: 'input[name*="Address" i][name*="2" i], input[id*="AddressLine2" i], input[id*="Address2" i]',
        required: false,
        source: 'address2'
      },

      // ZIP - Text Input
      zip: {
        selector: 'input[name*="Zip" i]:not([name*="Zip4" i]), input[id*="Zip" i]:not([id*="Zip4" i])',
        required: false,
        source: 'zipCode',
        transform: (zip) => zip ? zip.replace(/\D/g, '').substring(0, 5) : ''
      },

      // CITY - Text Input
      city: {
        selector: 'input[name*="City" i], input[id*="City" i]',
        required: false,
        source: 'city'
      },

      // STATE - Text Input
      state: {
        selector: 'input[name*="State" i], select[name*="State" i], input[id*="State" i]',
        required: false,
        type: 'text',
        fixedValue: 'NY'
      },

      // PRIMARY PHONE - 3 Text Inputs (area code - prefix - line)
      // Screenshot shows: 516 - 974 - 2038
      primaryPhoneArea: {
        selector: 'input[name*="PrimaryPhone" i][name*="Area" i], label:has-text("Primary Phone") ~ * input:nth-of-type(1)',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(0, 3);
        }
      },

      primaryPhonePrefix: {
        selector: 'input[name*="PrimaryPhone" i][name*="Prefix" i], label:has-text("Primary Phone") ~ * input:nth-of-type(2)',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(3, 6);
        }
      },

      primaryPhoneLine: {
        selector: 'input[name*="PrimaryPhone" i][name*="Line" i], label:has-text("Primary Phone") ~ * input:nth-of-type(3)',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(6, 10);
        }
      },

      // SECONDARY PHONE - 3 Text Inputs (optional)
      secondaryPhoneArea: {
        selector: 'input[name*="SecondaryPhone" i][name*="Area" i], label:has-text("Secondary Phone") ~ * input:nth-of-type(1)',
        required: false,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(0, 3);
        }
      },

      secondaryPhonePrefix: {
        selector: 'input[name*="SecondaryPhone" i][name*="Prefix" i], label:has-text("Secondary Phone") ~ * input:nth-of-type(2)',
        required: false,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(3, 6);
        }
      },

      secondaryPhoneLine: {
        selector: 'input[name*="SecondaryPhone" i][name*="Line" i], label:has-text("Secondary Phone") ~ * input:nth-of-type(3)',
        required: false,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          const cleaned = phone.replace(/\D/g, '');
          return cleaned.substring(6, 10);
        }
      },

      // LANGUAGE 1 - Dropdown (showing "English" in screenshot)
      language1: {
        selector: 'select[name*="Language" i][name*="1" i], select[id*="Language1" i]',
        required: false,
        source: 'languages',
        type: 'dropdown',
        transform: (langs) => {
          if (langs && langs.includes(',')) {
            return langs.split(',')[0].trim();
          }
          return langs || 'English';
        }
      },

      // LANGUAGE 2 - Dropdown
      language2: {
        selector: 'select[name*="Language" i][name*="2" i], select[id*="Language2" i]',
        required: false,
        source: 'languages',
        type: 'dropdown',
        transform: (langs) => {
          if (langs && langs.includes(',')) {
            const parts = langs.split(',');
            return parts[1] ? parts[1].trim() : '';
          }
          return '';
        }
      },

      // LANGUAGE 3 - Dropdown
      language3: {
        selector: 'select[name*="Language" i][name*="3" i], select[id*="Language3" i]',
        required: false,
        source: null,
        type: 'dropdown'
      },

      // APPLICATION DATE - Date Input
      applicationDate: {
        selector: 'input[name*="Application" i][name*="Date" i], input[id*="ApplicationDate" i]',
        required: false,
        type: 'date',
        fixedValue: () => {
          const now = new Date();
          return `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
        }
      }
    },

    // Submit button selector
    submitButton: 'button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Add Staff")',

    // Success indicators (to verify entry was successful)
    successIndicators: [
      'text=/successfully added/i',
      'text=/staff created/i',
      '.success-message',
      '[data-testid="success"]'
    ]
  }
};

// Helper function to extract value from caregiver data
export function extractFieldValue(caregiver, fieldConfig) {
  // Handle fixed values (can be string or function)
  if (fieldConfig.fixedValue !== undefined) {
    if (typeof fieldConfig.fixedValue === 'function') {
      return fieldConfig.fixedValue();
    }
    return fieldConfig.fixedValue;
  }

  // Handle default values if no source
  if (!fieldConfig.source) {
    return fieldConfig.defaultValue || '';
  }

  const sourceValue = caregiver[fieldConfig.source];

  if (!sourceValue && fieldConfig.defaultValue) {
    return fieldConfig.defaultValue;
  }

  if (!sourceValue) {
    return '';
  }

  if (fieldConfig.transform) {
    return fieldConfig.transform(sourceValue);
  }

  return sourceValue;
}
