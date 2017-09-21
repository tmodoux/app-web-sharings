/*globals document, pryv*/

var connection = null;
var appid = 'appweb-sharings';
var patientsStreamId = 'patients';
var doctor = {
    name: 'Nadia',
    username: 'nadia16',
    email: 'tmodoux@pryv.com'
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
  });
}

function notifyDoctor(access) {
  var msg = encodeURIComponent('Dear ' + doctor.name + ',\n\n'
  + 'The patient "' + lastname.value + ' ' + firstname.value + '"'
  + ' would like to share data with you through the following link:\n\n'
  + 'https://app-web-sharings/sharings?'
  + 'lastname=' + lastname.value
  + '&firstname=' + firstname.value
  + '&username=' + connection.username
  + '&domain=' + domain
  + '&token=' + access.token);
  
  var subject = encodeURIComponent('Pryv sharing');
  
  window.location.href = 'mailto:' + doctor.email
    + '?subject=Pryv&body=' + msg;
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

function updateSharingsTable(access) {
  var tr = document.createElement("tr");
  
  if(connection.username === doctor.username) {
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    td1.innerHTML = access.content.name;
    td2.innerHTML = visualizationLink(access);
    tr.appendChild(td1);
    tr.appendChild(td2);
  } else {
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    var td3 = document.createElement("td");
    td1.innerHTML = access.name;
    var btn1 = document.createElement("button");
    btn1.onclick = function() {
      revokeSharing(access);
      this.parentNode.parentNode.innerHTML="";
    }
    var btn2 = document.createElement("button");
    btn2.onclick = function() {
      notifyDoctor(access);
    }
    td2.appendChild(btn1);
    td3.appendChild(btn2);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
  }
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