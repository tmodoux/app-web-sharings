/*globals document, pryv*/

var connection = null;
var appid = 'appweb-sharings';
var patientsStreamId = 'patients';
var doctor = {
    name: 'Nadia',
    username: 'nadia16',
    token: 'cj7qbqxm200hh0bnw4zah844g'
};
var firstname = document.getElementById("firstname");
var lastname = document.getElementById("lastname");
var sharingsTable = document.getElementById("sharings");
var patientView = document.getElementById("patientView");
var doctorView = document.getElementById("doctorView");

/**
 * retrieve the registerURL from URL parameters
 */
function getRegisterURL() {
  // domain : pryv.utility.urls.parseClientURL().parseQuery().domain ?
  return pryv.utility.urls.parseClientURL().parseQuery()['reg-pryv'] || pryv.utility.urls.parseClientURL().parseQuery()['pryv-reg'];
}

var customRegisterUrl = getRegisterURL();
if (customRegisterUrl) {
  pryv.Auth.config.registerURL = {host: customRegisterUrl, 'ssl': true};
}

var domain = pryv.utility.urls.parseClientURL().parseQuery().domain || 'pryv.me';

var doctorConnection = new pryv.Connection({
  username: doctor.username,
  auth: doctor.token,
  domain: domain
});

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
          patientView.style.display = 'none';
          sharingsTable.style.display = 'none';
          sharingsTable.innerHTML = "";
          firstname.value="";
          lastname.value="";
        },
        needValidation: null,
        signedIn: function (connect) {
          connection = connect;
          initSharingsTable();
          if(connection.username === doctor.username) {
            getSharingsAsDoctor();
          } else {
            patientView.style.display = 'block';
            getSharings();
          }
        }
      }
    };
    pryv.Auth.setup(authSettings);
  }
};

function getSharings() {
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
      return alert('Impossible to get sharings as doctor');
    }
    sharingEvents.forEach(function (sharing) {
      updateSharingsTable(sharing);
    });
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
    
    // Store access token in doctor account
    var event = {
      streamId: patientsStreamId,
      type: 'numset/patient',
      content: {
        name: firstname.value + ' ' + lastname.value,
        username: connection.username,
        token: accessCreated.token
      },
    };
    doctorConnection.events.create(event, function (err, eventCreated) { 
      if(err) {
        console.log(err);
        return alert('Impossible to store sharing in doctor account');
      }
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
    th1.innerHTML = 'Patient name';
    th2.innerHTML = 'Sharing link';
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
    td1.innerHTML = access.content.name;
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
    // Delete on doctor account
    var filter = new pryv.Filter({streams : [patientsStreamId]});
    doctorConnection.events.get(filter, function (err, events) {
      if(err) {
        console.log(err);
        return alert('Impossible to delete sharing in doctor account');
      }
      events.forEach(function(event) {
        if(event.content.token === access.token) {
          console.log(event);
          doctorConnection.events.delete({id: event.id}, function (err, events) {
            if(err) {
              console.log(err);
              return alert('Impossible to delete sharing in doctor account');
            }
          });
        }
      });
    });
  });
}