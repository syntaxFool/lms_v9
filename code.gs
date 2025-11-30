function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSheets(ss);
  
  const leads = readSheet(ss.getSheetByName('Leads'));
  const activities = readSheet(ss.getSheetByName('Activities'));
  const users = readSheet(ss.getSheetByName('Users'));
  const logs = readSheet(ss.getSheetByName('Logs'));
  const interests = readSheet(ss.getSheetByName('Interests'));
  
  // Read Settings Sheet (Col 1 = Location, Col 2 = Source, Col 3 = ScriptURL, Col 4 = AppTitle)
  const settingsSheet = ss.getSheetByName('Settings');
  const settingsData = settingsSheet ? settingsSheet.getDataRange().getValues() : [];
  let locations = [];
  let sources = [];
  let scriptUrl = '';
  let appTitle = '';
  let primaryColor = '';
  let secondaryColor = '';
  if (settingsData.length > 0) {
    const headers = settingsData[0];
    const scriptUrlCol = headers.indexOf('ScriptURL');
    const appTitleCol = headers.indexOf('AppTitle');
    const primaryColorCol = headers.indexOf('PrimaryColor');
    const secondaryColorCol = headers.indexOf('SecondaryColor');
    if (scriptUrlCol !== -1 && settingsData.length > 1) {
      scriptUrl = settingsData[1][scriptUrlCol] || '';
    }
    if (appTitleCol !== -1 && settingsData.length > 1) {
      appTitle = settingsData[1][appTitleCol] || '';
    }
    if (primaryColorCol !== -1 && settingsData.length > 1) {
      primaryColor = settingsData[1][primaryColorCol] || '';
    }
    if (secondaryColorCol !== -1 && settingsData.length > 1) {
      secondaryColor = settingsData[1][secondaryColorCol] || '';
    }
    for (let i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0]) locations.push(settingsData[i][0]);
      if (settingsData[i][1]) sources.push(settingsData[i][1]);
    }
  }

  // Re-nest activities
  leads.forEach(lead => {
    lead.activities = activities.filter(a => a.leadId === lead.id).map(a => a);
    lead.value = parseFloat(lead.value) || 0;
  });

  return ContentService.createTextOutput(JSON.stringify({
    leads: leads,
    users: users,
    logs: logs,
    interests: interests,
    settings: { locations: locations, sources: sources, scriptUrl: scriptUrl },
    config: { appTitle: appTitle, primaryColor: primaryColor, secondaryColor: secondaryColor }
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSheets(ss);
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'save_all') {
      if(data.users) writeSheet(ss.getSheetByName('Users'), data.users, ['id', 'username', 'password', 'name', 'role']);
      if(data.logs) writeSheet(ss.getSheetByName('Logs'), data.logs, ['id', 'timestamp', 'message']);
      
      if(data.leads) {
        const flatLeads = data.leads.map(l => {
          const { activities, ...rest } = l; 
          return rest;
        });
        
        const flatActivities = [];
        data.leads.forEach(l => {
          if (l.activities && Array.isArray(l.activities)) {
            l.activities.forEach(a => flatActivities.push({ ...a, leadId: l.id }));
          }
        });

        writeSheet(ss.getSheetByName('Leads'), flatLeads, ['id', 'name', 'phone', 'email', 'status', 'value', 'interest', 'location', 'source', 'assignedTo', 'notes', 'createdAt']);
        writeSheet(ss.getSheetByName('Activities'), flatActivities, ['id', 'leadId', 'type', 'note', 'timestamp', 'createdBy', 'role']);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    // New: Save ScriptURL and AppName to Settings
    if (data.action === 'save_script_url' && (data.scriptUrl || data.appTitle || data.primaryColor || data.secondaryColor)) {
      const settingsSheet = ss.getSheetByName('Settings');
      let settingsData = settingsSheet.getDataRange().getValues();
      // Ensure header row
      if (settingsData.length === 0) {
        settingsSheet.appendRow(['Locations', 'Sources', 'ScriptURL', 'AppTitle', 'PrimaryColor', 'SecondaryColor']);
        settingsData = settingsSheet.getDataRange().getValues();
      }
      // Find columns
      const headers = settingsData[0];
      let scriptUrlCol = headers.indexOf('ScriptURL');
      let appTitleCol = headers.indexOf('AppTitle');
      let primaryColorCol = headers.indexOf('PrimaryColor');
      let secondaryColorCol = headers.indexOf('SecondaryColor');
      if (scriptUrlCol === -1) { scriptUrlCol = headers.length; headers.push('ScriptURL'); }
      if (appTitleCol === -1) { appTitleCol = headers.length; headers.push('AppTitle'); }
      if (primaryColorCol === -1) { primaryColorCol = headers.length; headers.push('PrimaryColor'); }
      if (secondaryColorCol === -1) { secondaryColorCol = headers.length; headers.push('SecondaryColor'); }
      settingsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Ensure at least one data row
      if (settingsData.length < 2) {
        const row = [];
        for (let i = 0; i < headers.length; i++) row.push('');
        settingsSheet.appendRow(row);
        settingsData = settingsSheet.getDataRange().getValues();
      }
      // Set values
      if (data.scriptUrl) settingsSheet.getRange(2, scriptUrlCol + 1).setValue(data.scriptUrl);
      if (data.appTitle) settingsSheet.getRange(2, appTitleCol + 1).setValue(data.appTitle);
      if (data.primaryColor) settingsSheet.getRange(2, primaryColorCol + 1).setValue(data.primaryColor);
      if (data.secondaryColor) settingsSheet.getRange(2, secondaryColorCol + 1).setValue(data.secondaryColor);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Helpers ---
function setupSheets(ss) {
  const sheets = ['Leads', 'Activities', 'Users', 'Logs', 'Interests', 'Settings'];
  sheets.forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });
}

function readSheet(sheet) {
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function writeSheet(sheet, data, headers) {
  sheet.clearContents();
  if (data.length === 0) {
    sheet.appendRow(headers);
    return;
  }
  const output = [headers];
  data.forEach(item => {
    const row = headers.map(h => {
      const val = item[h];
      return val === undefined || val === null ? '' : val;
    });
    output.push(row);
  });
  sheet.getRange(1, 1, output.length, headers.length).setValues(output);
}