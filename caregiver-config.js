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
      'date4': 'applicationDate',     // Date of Application (adjust column ID as needed)
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

      // CAREGIVER TYPE - Dropdown - Employee (Hiring Status field in HHA Exchange)
      caregiverType: {
        selector: 'select[id*="HiringStatus" i], select[name*="HiringStatus" i]',
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

      // GENDER - Dropdown - REQUIRED (make assumption based on name)
      gender: {
        selector: 'select[name*="Gender" i], select[id*="Gender" i]',
        required: true,
        type: 'dropdown',
        fixedValue: 'Female' // Default assumption (vast majority are female per user)
      },

      // INITIALS - Text Input - REQUIRED
      initials: {
        selector: 'input[name*="Initials" i], input[id*="Initials" i]',
        required: true,
        source: 'applicantName',
        transform: (name) => {
          const parts = name.trim().split(' ');
          return parts.map(p => p[0]).join('').toUpperCase().substring(0, 3);
        }
      },

      // DATE OF BIRTH - Date Input (HTML5 type="date" requires YYYY-MM-DD format)
      dateOfBirth: {
        selector: 'input[name*="Birth" i], input[id*="Birth" i], input[type="date"]',
        required: true,
        source: 'dateOfBirth',
        type: 'date',
        fixedValue: '1990-01-01', // Placeholder until Monday data available (ISO format for HTML5 date input)
        transform: (date) => {
          // HTML5 date inputs require YYYY-MM-DD format
          if (!date || date === '1990-01-01') return '1990-01-01'; // Use placeholder in ISO format
          if (date && date.includes('-')) {
            // Already in YYYY-MM-DD format
            return date;
          }
          if (date && date.includes('/')) {
            // Convert MM/DD/YYYY to YYYY-MM-DD
            const [month, day, year] = date.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          return date;
        }
      },

      // SOCIAL SECURITY NUMBER - Text Input - REQUIRED (format: XXX-XX-XXXX)
      ssn: {
        selector: 'input[name*="SSN" i]:not([type="hidden"]), input[id*="SSN" i]:not([type="hidden"]), input[name*="Social" i]:not([type="hidden"])',
        required: true,
        source: 'ssn',
        fixedValue: '777-88-9999', // Placeholder - need to add to Monday.com (using different test SSN with dashes)
        transform: (ssn) => {
          if (!ssn || ssn === '777-88-9999') return '777-88-9999';
          // Format SSN: remove all non-digits, then add dashes
          const cleaned = ssn.replace(/\D/g, '');
          if (cleaned.length === 9) {
            return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 5)}-${cleaned.substring(5, 9)}`;
          }
          return ssn; // Return as-is if already formatted
        }
      },

      // ALT. CAREGIVER CODE - Text Input (optional)
      altCaregiverCode: {
        selector: 'input[name*="CaregiverCode" i], input[id*="AltCode" i]',
        required: false,
        source: null
      },

      // STATUS - Dropdown - Active (NOT HiringStatus)
      status: {
        selector: 'select[name*="Status" i]:not([name*="Marital" i]):not([name*="Hiring" i]), select[id*="Status" i]:not([id*="Marital" i]):not([id*="Hiring" i])',
        required: true,
        type: 'dropdown',
        fixedValue: 'Active'
      },

      // EMPLOYMENT TYPE - Checkboxes (PCA, HHA, etc.)
      // Note: This is a checkbox group, not a single field
      employmentTypePCA: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxChkEmploymentType_0"]',  // PCA checkbox - first in employment type list
        required: false,
        type: 'checkbox',
        fixedValue: true  // Always check PCA employment type
      },

      employmentTypeHHA: {
        selector: 'input[type="checkbox"][value="HHA"], input[type="checkbox"][id*="HHA" i]',
        required: false,
        source: 'certificationType',
        type: 'checkbox',
        transform: (certType) => certType && certType.toLowerCase().includes('hha')
      },

      // REFERRAL SOURCE - Dropdown - OPTIONAL FOR NOW (need to inspect actual dropdown values)
      // COMMENTED OUT: "Website" doesn't match any dropdown option in HHA Exchange
      // referralSource: {
      //   selector: 'select[name*="Referral" i], select[id*="ReferralSource" i]',
      //   required: false,
      //   type: 'dropdown',
      //   fixedValue: 'Website' // Trying "Website" as it's listed first in user's data
      // },

      // TEAM - Dropdown - OPTIONAL FOR NOW (need to inspect actual dropdown values)
      team: {
        selector: 'select[name*="Team" i], select[id*="Team" i]',
        required: false,
        type: 'dropdown',
        fixedValue: 'Nassau' // Per user's data - may need different value
      },

      // LOCATION - Dropdown - OPTIONAL FOR NOW (need to inspect actual dropdown values)
      location: {
        selector: 'select[name*="Location" i], select[id*="Location" i]',
        required: false,
        source: 'preferredLocations',
        type: 'dropdown',
        defaultValue: 'Suffolk'
      },

      // BRANCH - Dropdown - OPTIONAL FOR NOW (need to inspect actual dropdown values)
      branch: {
        selector: 'select[name*="Branch" i], select[id*="Branch" i]',
        required: false,
        type: 'dropdown',
        fixedValue: 'Main Office'
      },

      // ADDRESS LINE 1 / STREET 1 - Text Input - REQUIRED (need to add to Monday.com)
      // This is the main "Street 1" field in Demographics section
      addressLine1: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxTxtStreet1"]',  // Street 1 field (the REAL address field)
        required: true,
        source: 'address1',
        fixedValue: '123 Main Street' // Placeholder until Monday data available
      },

      // ADDRESS LINE 2 - Text Input
      addressLine2: {
        selector: 'input[name*="Address" i][name*="2" i], input[id*="AddressLine2" i], input[id*="Address2" i]',
        required: false,
        source: 'address2'
      },

      // ZIP - Text Input - REQUIRED (need to add to Monday.com)
      zip: {
        selector: 'input[name*="Zip" i]:not([name*="Zip4" i]), input[id*="Zip" i]:not([id*="Zip4" i])',
        required: true,
        source: 'zipCode',
        fixedValue: '10001', // Placeholder until Monday data available
        transform: (zip) => zip && zip !== '10001' ? zip.replace(/\D/g, '').substring(0, 5) : '10001'
      },

      // CITY - Text Input - REQUIRED (need to add to Monday.com)
      city: {
        selector: 'input[name*="City" i], input[id*="City" i]',
        required: true,
        source: 'city',
        fixedValue: 'New York' // Placeholder until Monday data available
      },

      // STATE - Text Input - REQUIRED (need to add to Monday.com)
      state: {
        selector: 'input[type="text"][name*="State" i]:not([type="hidden"]), select[name*="State" i], input[type="text"][id*="State" i]:not([type="hidden"]):not([id*="__VIEW" i])',
        required: true,
        type: 'text',
        fixedValue: 'NY'
      },

      // PRIMARY PHONE (Home Phone) - 3 Text Inputs (area code - prefix - line)
      // Screenshot shows: 516 - 974 - 2038
      primaryPhoneArea: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxTxtHomePhone_uxtxtPhone1"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
          return cleaned.substring(0, 3);
        }
      },

      primaryPhonePrefix: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxTxtHomePhone_uxtxtPhone2"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
          return cleaned.substring(3, 6);
        }
      },

      primaryPhoneLine: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxTxtHomePhone_uxtxtPhone3"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
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

      // MOBILE/TEXT MESSAGING PHONE (Notification Text Number at bottom) - 3 Text Inputs - REQUIRED
      mobilePhoneArea: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxtxtNotificationTextNumber_uxtxtPhone1"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
          return cleaned.substring(0, 3);
        }
      },

      mobilePhonePrefix: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxtxtNotificationTextNumber_uxtxtPhone2"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
          return cleaned.substring(3, 6);
        }
      },

      mobilePhoneLine: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxtxtNotificationTextNumber_uxtxtPhone3"]',
        required: true,
        source: 'phone',
        type: 'phone-part',
        transform: (phone) => {
          let cleaned = phone.replace(/\D/g, '');
          // Strip leading 1 (country code) if present
          if (cleaned.length === 11 && cleaned.startsWith('1')) {
            cleaned = cleaned.substring(1);
          }
          return cleaned.substring(6, 10);
        }
      },

      // EMAIL - Text Input - REQUIRED
      email: {
        selector: 'input[type="email"], input[name*="Email" i], input[id*="Email" i]',
        required: true,
        source: 'email'
      },

      // LANGUAGE 1 - Dropdown - REQUIRED (If two languages selected use Language 2)
      language1: {
        selector: 'select[name*="Language" i][name*="1" i], select[id*="Language1" i]',
        required: true,
        source: 'languages',
        type: 'dropdown',
        transform: (langs) => {
          if (langs && langs.includes(',')) {
            return langs.split(',')[0].trim();
          }
          return langs || 'English';
        }
      },

      // LANGUAGE 2 - Dropdown - REQUIRED (must be different from Language 1)
      language2: {
        selector: 'select[name*="Language" i][name*="2" i], select[id*="Language2" i]',
        required: true,
        source: 'languages',
        type: 'dropdown',
        transform: (langs) => {
          if (langs && langs.includes(',')) {
            const parts = langs.split(',');
            return parts[1] ? parts[1].trim() : 'Spanish'; // Default to Spanish if no second language
          }
          return 'Spanish'; // Default to Spanish (different from Language 1 which defaults to English)
        }
      },

      // LANGUAGE 3 - Dropdown
      language3: {
        selector: 'select[name*="Language" i][name*="3" i], select[id*="Language3" i]',
        required: false,
        source: null,
        type: 'dropdown'
      },

      // APPLICATION DATE - Date Input - REQUIRED
      applicationDate: {
        selector: 'input[id="ctl00_ContentPlaceHolder1_uxtxtApplicationDate"]',
        required: true,
        type: 'date',
        source: 'applicationDate',  // Get from Monday.com
        fixedValue: (caregiver) => {
          // Try to get from Monday.com first - check if caregiver and property exist
          const mondayDate = caregiver && caregiver.applicationDate ? caregiver.applicationDate : null;

          // If no date from Monday, use today
          if (!mondayDate) {
            const now = new Date();
            return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
          }
          // If already in YYYY-MM-DD format, return as-is
          if (mondayDate.includes('-') && mondayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return mondayDate;
          }
          // If in MM/DD/YYYY format, convert to YYYY-MM-DD
          if (mondayDate.includes('/')) {
            const [month, day, year] = mondayDate.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          return mondayDate;
        }
      }
    },

    // Submit button selector
    submitButton: 'input[type="submit"][value*="Save" i], button:has-text("Save"), input[id*="Save" i], input[name*="Save" i], button[type="submit"], button:has-text("Submit"), button:has-text("Add Staff")',

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
