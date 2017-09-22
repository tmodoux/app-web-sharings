/*globals document, pryv*/

var connection = null;
var appid = 'appweb-sharings';
var patientsStreamId = 'patients';
var doctor = {
    name: 'Nadia',
    username: 'nadia16',
    email: 'tmodoux@pryv.com'
};
var sharingsTable = document.getElementById("sharings");
var patientView = document.getElementById("patientView");
var doctorView = document.getElementById("doctorView");

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
var domain = pryv.utility.urls.parseClientURL().parseQuery().domain || 'pryv.me';

var doctorConnection = new pryv.Connection({
  username: doctor.username,
  auth: doctor.token,
  domain: domain
});

document.onreadystatechange = function () {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('logo-pryv').style.display = 'block';
  
  document.getElementById('doctorName').innerHTML = doctor.name;
  
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
          patientView.style.display = 'none';
          sharingsTable.style.display = 'none';
          sharingsTable.innerHTML = "";
        },
        needValidation: null,
        signedIn: function (connect) {
          connection = connect;
          initSharingsTable();
          if(connection.username === doctor.username) {
            initSharingsAsDoctor();
          } else {
            patientView.style.display = 'block';
            initSharingsAsPatient();
          }
        }
      }
    };
    pryv.Auth.setup(authSettings);
  }
};

function initSharingsAsPatient() {
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

function initSharingsAsDoctor() {
  // Get existing sharings
  var filter = new pryv.Filter({streams : [patientsStreamId]});
  connection.events.get(filter, function (err, sharingEvents) {
    if(err) {
      console.log(err);
      return alert('Impossible to get sharings');
    }
    sharingEvents.forEach(function (sharing) {
      updateSharingsTable(sharing);
    });
    
    // Check if there is a new sharing to create
    // TODO: Make this within a confirmation popup
    var urlParams = new URLSearchParams(window.location.search);
    var token = urlParams.get("token");
    var username = urlParams.get("username");
    if(token != null && username != null) {
      // Check that the new sharing is not already existing
      var duplicateTokens = sharingEvents.filter(function (sharing) {
        return sharing.content.token === token;
      });
      if(duplicateTokens.length === 0) {
        // Store new sharing in doctor account
        var event = {
          streamId: patientsStreamId,
          type: 'patient/sharing',
          content: {
            username: username,
            token: token
          },
        };
        connection.events.create(event, function (err, sharingEvent) { 
          if(err) {
            console.log(err);
            return alert('Impossible to store sharing in doctor account');
          }
          updateSharingsTable(sharingEvent);
        });
      }
    }
  });
}

function createSharing() {
  var access = {
    name: 'For my doctor ' + doctor.name,
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
  });
}

function notifyDoctor(sharing) {
     var link = window.location.pathname + "?token=" + sharing.token + '&username=' + connection.username;
     var subject = encodeURIComponent('Pryv sharing');
     var msg = encodeURIComponent('Hello,\n\n The patient ' + connection.username
       + ' would like to share its data with you:\n\n'
       + link);
     window.location.href = 'mailto:' + doctor.email
       + '?subject=' + subject + '&body=' + msg;
}

function visualizationLink(sharing) {
  var visualizationInterface = 'https://pryv.github.io/app-web-plotly/?';
  return visualizationInterface
    + 'username='+sharing.content.username+'&'
    + 'domain='+domain+'&'  
    + 'auth='+sharing.content.token;
}

function initSharingsTable() {
  var tr = document.createElement("tr");
  
  if(connection.username === doctor.username) {
    var th1 = document.createElement("th");
    var th2 = document.createElement("th");
    th1.innerHTML = 'Patient name';
    th2.innerHTML = 'Sharing link';
    tr.appendChild(th1);
    tr.appendChild(th2);
  } else {
    var th1 = document.createElement("th");
    var th2 = document.createElement("th");
    var th3 = document.createElement("th");
    th1.innerHTML = 'Sharing name';
    th2.innerHTML = 'Revoke';
    th3.innerHTML = 'Notify doctor';
    tr.appendChild(th1);
    tr.appendChild(th2);
    tr.appendChild(th3);
  }
  sharingsTable.appendChild(tr);
  sharingsTable.style.display = 'block';
}

function updateSharingsTable(sharing) {
  var tr = document.createElement("tr");
  
  if(connection.username === doctor.username) {
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    var btn1 = document.createElement("button");
    btn1.onclick = function() {
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
          btn1.parentNode.parentNode.innerHTML="";
          alert('This sharing was revoked');
        } else {
          window.open(visualizationLink(sharing), '_blank');
        }
      });
    }
    td1.innerHTML = sharing.content.username;
    td2.appendChild(btn1);
    tr.appendChild(td1);
    tr.appendChild(td2);
  } else {
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    var td3 = document.createElement("td");
    td1.innerHTML = sharing.name;
    var btn1 = document.createElement("button");
    btn1.onclick = function() {
      revokeSharing(sharing);
      this.parentNode.parentNode.innerHTML="";
    }
    var btn2 = document.createElement("button");
    btn2.onclick = function() {
      notifyDoctor(sharing);
    }
    td2.appendChild(btn1);
    td3.appendChild(btn2);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
  }
  sharingsTable.appendChild(tr);
}

function revokeSharing(sharing) {
  connection.accesses.delete(sharing.id, function (err, accessDeletion) {
    if(err) {
      console.log(err);
      return alert('Impossible to revoke sharing');
    }
  });
}