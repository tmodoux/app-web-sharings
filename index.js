/*globals document, pryv*/

var connection = null;
var appid = 'appweb-sharings';
var patientsStreamId = 'patients';
var sharingsTable = document.getElementById("sharings");
var patientView = document.getElementById("patientView");
var doctorView = document.getElementById("doctorView");
var patientEmail = document.getElementById("email");
var patientUsername = document.getElementById("username");
var doctor = {
  username : 'nadia16',
  name : 'Nadia'
};

/**
 * retrieve the registerURL from URL parameters
 */
function getRegisterURL() {
  return pryv.utility.urls.parseClientURL().parseQuery()['reg-pryv'] || pryv.utility.urls.parseClientURL().parseQuery()['pryv-reg'];
}

var customRegisterUrl = getRegisterURL();
if (customRegisterUrl) {
  pryv.Auth.config.registerURL = {host: customRegisterUrl, 'ssl': true};
}

// TODO: make sure to have a configurable domain at any step or not at all
var domain = pryv.utility.urls.parseClientURL().parseQuery().domain || 'pryv.me';

document.onreadystatechange = function () {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('logo-pryv').style.display = 'block';
  var state = document.readyState;
  if (state == 'complete') {
    // Authenticate user
    var authSettings = {
      requestingAppId: appid,
      requestedPermissions: [
        {
          streamId: '*',
          level: 'manage'
        }
      ],
      returnURL: false,
      spanButtonID: 'pryv-button',
      callbacks: {
        needSignin: function () {
          connection = null;
          doctorView.style.display = 'none';
          sharingsTable.style.display = 'none';
          sharingsTable.innerHTML = "";
          patientEmail.value="";
          patientUsername.value="";
        },
        needValidation: null,
        signedIn: function (connect) {
          connection = connect;
          initSharingsTable();
          if(connection.username === doctor.username) {
            doctorView.style.display = 'block';
            getSharingsAsDoctor();
          } else {
            getSharingsAsPatient();
            // Check if there is a new sharing to create
            // TODO: Make this within a confirmation popup
            var urlParams = new URLSearchParams(window.location.search);
            var token = urlParams.get("token");
            if(token != null) {
              createSharing(token);
            }
          }
        }
      }
    };
    pryv.Auth.setup(authSettings);
  }
};

function getSharingsAsPatient() {
  connection.accesses.get(function (err, accesses) {
    if(err) {
      console.log(err);
      return alert('Impossible to get sharings');
    }
    var sharings = accesses.filter(function(access){
      return access.type === 'shared';
    });
    sharings.forEach(function (sharing) {
      updateSharingsTable(sharing);
    });
  });
}

function getSharingsAsDoctor() {
  var filter = new pryv.Filter({streams : [patientsStreamId]});
  connection.events.get(filter, function (err, sharingEvents) {
    if(err) {
      console.log(err);
      return alert('Impossible to get sharings');
    }
    sharingEvents.forEach(function (sharing) {
      // Check if sharing is still valid (not revoked)
      // TODO: Replace with an email from patient notifying the revocation
      var patientConnection = new pryv.Connection({
        username: sharing.content.username,
        auth: sharing.content.token,
        domain: domain
      });
      patientConnection.accessInfo(function (err) {
        // Remove revoked sharings
        if(err) {
          connection.events.delete({id:sharing.id}, function (err) {
            if(err) {
              console.log(err);
            }
          });
        } else {
          updateSharingsTable(sharing);
        }
      });
    });
  });
}

function createSharing(doctorToken) {
  var access = {
    name: 'For my doctor ' + doctor.username,
    permissions: [
      {
        streamId: '*',
        level: 'contribute'
      }
    ]
  };

  connection.accesses.create(access, function (err, accessCreated) {
    if(err) {
      console.log(err);
      return alert('Impossible to create sharing');
    }
    updateSharingsTable(accessCreated);
    
    // Store access token in doctor account
    var event = {
      streamId: connection.username,
      type: 'patient/sharing',
      content: {
        username: connection.username,
        token: accessCreated.token
      },
    };
    
    var doctorConnection = new pryv.Connection({
      username: doctor.username,
      auth: doctorToken,
      domain: domain
    });
    doctorConnection.events.create(event, function (err, eventCreated) { 
      if(err) {
        console.log(err);
        return alert('Impossible to store sharing in doctor account');
      }
    });
  });
}

function askForSharing() {
  // Allows patient to later store its sharing inside doctor account
  // TODO: delete all these entries for patient in doctor account when not needed anymore...
  var stream = {
    name: patientUsername.value,
    id: patientUsername.value,
    parentId: patientsStreamId
  };
  // Prepare patient stream in doctor account
  connection.streams.create(stream, function (err) { 
    if(err) {
      console.log(err);
      return alert('Impossible to ask for sharing');
    }
    var access = {
      name: 'Ask patient' + patientUsername.value + 'for sharing',
      permissions: [
        {
          streamId: patientUsername.value,
          level: 'contribute'
        }
      ]
    };
    // Give access to patient
    connection.accesses.create(access, function (err, accessCreated) {
      if(err) {
        console.log(err);
        return alert('Impossible to ask for sharing');
      }
      // Send email to patient
      var link = window.location + "?token=" + accessCreated.token;
      var subject = encodeURIComponent('Pryv sharing');
      var msg = encodeURIComponent('Hello,\n\n The doctor ' + doctor.name
        + ' would like to have access to your patient data:\n\n'
        + link);
      window.location.href = 'mailto:' + patientEmail.value
        + '?subject=' + subject + '&body=' + msg;
    });
  });
}

function visualizationLink(access) {
  var visualizationInterface = 'https://pryv.github.io/app-web-plotly/?';
  return '<a target="_blank" href='+ visualizationInterface
    + 'username='+access.content.username+'&'
    + 'domain='+domain+'&'
    + 'auth='+access.content.token +'>Show graphs</a>'
}

function initSharingsTable() {
  var tr = document.createElement("tr");
  var th1 = document.createElement("th");
  var th2 = document.createElement("th");
  
  if(connection.username === doctor.username) {
    th1.innerHTML = 'Patient';
    th2.innerHTML = 'View graphs';
  } else {
    th1.innerHTML = 'Sharing name';
    th2.innerHTML = 'Revoke';
  }
  tr.appendChild(th1);
  tr.appendChild(th2);
  sharingsTable.appendChild(tr);
  sharingsTable.style.display = 'block';
}

function updateSharingsTable(access) {
  var tr = document.createElement("tr");
  var td1 = document.createElement("td");
  var td2 = document.createElement("td");
  
  if(connection.username === doctor.username) {
    td1.innerHTML = access.content.username;
    td2.innerHTML = visualizationLink(access);
  } else {
    td1.innerHTML = access.name;
    var btn = document.createElement("button");
    btn.onclick = function() {
      revokeSharing(access);
      this.parentNode.parentNode.innerHTML="";
    }
    td2.appendChild(btn);
  }
  tr.appendChild(td1);
  tr.appendChild(td2);
  sharingsTable.appendChild(tr);
}

function revokeSharing(access) {
  connection.accesses.delete(access.id, function (err, accessDeletion) {
    if(err) {
      console.log(err);
      return alert('Impossible to revoke sharing');
    }
  });
}