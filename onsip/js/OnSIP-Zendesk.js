/** ZENDESK library for OnSIP-Click-To-Call **/

var ZENDESK = {
    'contacts'    : [],
    'base_url'    : '',
    'user'        : '',
    'pwd'         : '',
    'attempts'    : 0,
    'log_context' : 'ZENDESK',
    'refresh'     : 60000 * 25, // Refresh every 25 min
    'paginate'    : -1,
    'to_id'       : undefined
};

ZENDESK.verify = function (call, zendesk_url, user, pwd) {
    var xml, xmlobject, user_node, id;
    var xhr   = new XMLHttpRequest ();
    var ok    = false;
    var that  = this;
    var tmout = 10000;

    xhr.onreadystatechange = function () {
	if (xhr.readyState === 4) {
            if (xhr.status === 200) {
		xml       = xhr.responseText;
		xmlobject = (new DOMParser()).parseFromString(xml, "text/xml");
		user_node = xmlobject.getElementsByTagName("user");
		if (user_node && user_node.length) {
		    id = user_node[0].getElementsByTagName ("id")[0].firstChild.nodeValue;
		    dbg.log (that.log_context, "ID of Current User " + id);
		}
		ok = true;
		if (!isNaN(id)) {
		    call.onSuccess ();
		} else {
		    call.onError ();
		}
	    } else {
		call.onError (xhr.status);
	    }
	}
    }
    var a = function () {
	that._abortXhr (xhr, ok, call, "verify");
    }
    xhr.open('GET', zendesk_url + '/users/current.xml', false, user, pwd);
    setTimeout (a, tmout);
    xhr.send();
};

ZENDESK._abortXhr = function (xhr, ok, call, contxt) {
    if (!ok) {
	if (!contxt) {
	    contxt = '';
	}
	dbg.log (this.log_context, "Aborting call " + contxt);
        xhr.abort();
        if (call && call.onError) {
	    call.onError('aborted');
        }
    }
};

ZENDESK._createDefaultTicket = function (costumer) {
    var priority  = 1; /** Low Priority **/
    var status    = 0; /** New Ticket **/
    var tag       = "onsip";
    var comment   = "Auto Generated by OnSIP's Chrome Click-To-Call Extension";
    var requester = costumer.id;
    var full_name = costumer.full_name;
    var subject   = "Auto Generated Ticket from Conversation with " + full_name;

    var ticket    =
	"<ticket>" +
	   "<priority-id>"  + priority  + "</priority-id>"  +
	   "<status-id>"    + status    + "</status-id>"    +
	   "<set-tags>"     + tag       + "</set-tags>"     +
	   "<subject>"      + subject   + "</subject>"      +
	   "<description>"  + comment   + "</description>"  +
	   "<requester_id>" + requester + "</requester_id>" +
	"</ticket>";

    dbg.log (this.log_context, 'Posting ' + ticket);
    return ticket;
};

ZENDESK._createDefaultUnknownTicket = function (phone) {
    var priority  = 1; /** Low Priority **/
    var status    = 0; /** New Ticket   **/
    var tag       = "onsip";
    var comment   = "Auto Generated by OnSIP's Chrome Click-To-Call Extension";
    var subject   = "Auto Generated Ticket from Conversation with " + phone;

    var ticket    =
        "<ticket>" +
           "<priority-id>"  + priority  + "</priority-id>"  +
           "<status-id>"    + status    + "</status-id>"    +
           "<set-tags>"     + tag       + "</set-tags>"     +
           "<subject>"      + subject   + "</subject>"      +
           "<description>"  + comment   + "</description>"  +
        "</ticket>";

    dbg.log (this.log_context, 'Posting ' + ticket);
    return ticket;
};


/** Convention
 *   <ticket>
 *      <priority-id> {STUFF} </priority-id>
 *      <description> {STUFF} </description>
 *      <requester_id>{STUFF} </requester_id>
 *   </ticket>
**/
ZENDESK.postNote = function (costumer, user_tz) {
    var nt, full_name;
    dbg.log (this.log_context, 'Searching for costumer');
    if (costumer && costumer.full_name) {
	full_name = costumer.full_name;
	if (trim (full_name).length === 0) {
	    full_name = undefined;
	}
	if (full_name && full_name.length > 0) {
	    dbg.log (this.log_context, 'Found constumer, posting note');
	    nt = this._createDefaultTicket (costumer);
	    this.postNoteToProfile (nt);
	}
    }
};

ZENDESK.postNoteUnknown = function (phone, user_tz) {
    var nt;
    if (phone) {
	nt = this._createDefaultUnknownTicket (phone);
	this.postNoteToProfile (nt);
    }
};

/** Find the person or company by phone number **/
ZENDESK.findContact = function (phone_number) {
    var  i, j, len, costumer;
    /** Find people first **/
    for (i = 0, len = this.contacts.length; i < len; i += 1) {
	if (this.contacts[i].phone_number === phone_number) {
	    costumer      = this.contacts[i];
	    costumer.type = 'user';
	    dbg.log (this.log_context, 'Found contact');
	    return costumer;
        }
    }
    return;
};

/** Normalize the phone number **/
ZENDESK._normalizePhoneNumber = function (phone_number) {
    var clean_phone_num, clean_phone_ext;
    clean_phone_ext = getPhoneExtension( phone_number );
    clean_phone_num = removeExtention  ( phone_number );
    clean_phone_num = cleanPhoneNo     (clean_phone_num);
    if (clean_phone_num.length === 10) {
	clean_phone_num = '1' + clean_phone_num;
    }
    if (clean_phone_ext) {
	clean_phone_num += cleanPhoneNo (clean_phone_ext);
    }

    return clean_phone_num;
};

ZENDESK.postNoteToProfile = function (note, call) {
    var xhr   = new XMLHttpRequest();
    var that  = this;
    var ok    = false;
    var tmout = 45000;

    xhr.onreadystatechange = function () {
	if (xhr.readyState !== 4) {
	    return false;
	}
	if (xhr.status !== 201) {
	    if (that.call && that.call.onError) {
	        that.call.onError (xhr.status);
	    }
	} else {
	    ok = true;
	    if (that.call && that.call.onSuccess) {
	        that.call.onSuccess ();
	    }
	}
	return true;
    };
    var a = function () {
	that._abortXhr (xhr, ok, call, "postNoteToProfile");
    }
    xhr.open ("POST", this.base_url + "/tickets.xml", true, this.user, this.pwd);
    xhr.setRequestHeader("Content-Type", "application/xml");
    setTimeout (a, tmout);
    xhr.send (note);
};

ZENDESK.search  = function (requester_id, call) {
    var that = this;
    dbg.log (this.log_context, 'Search Requester ID ' + requester_id);
    this._search (requester_id, {
        onSuccess : function (xml) {
            var xmlobject    = (new DOMParser()).parseFromString(xml, "text/xml");
	    var root_node    = xmlobject.getElementsByTagName("records");
	    var subject      = '';
	    var record_count = 0;
	    var tags         = 0;
	    var is_onsip     = false;
	    var nice_id ;
	    var holder;

	    if (root_node && root_node.length) {
		record_count = root_node[0].getAttribute ('count');
		record_nodes = root_node[0].getElementsByTagName("record");
		if (record_count > 0) {
		    holder = record_nodes[0].getElementsByTagName ("subject");
		    if (holder && holder.length) {
			if (holder[0].firstChild && holder[0].firstChild.nodeValue) {
			    subject = holder[0].firstChild.nodeValue;
			}
		    }
		    tags   = record_nodes[0].getElementsByTagName("current-tags");
		    if (tags && tags.length) {
			if (tags[0].firstChild && tags[0].firstChild.nodeValue) {
			    if (tags[0].firstChild.nodeValue.indexOf('onsip') !== -1) {
				is_onsip = true;
			    }
			}
		    }
		    holder  = record_nodes[0].getElementsByTagName("nice-id");
		    if (holder && holder.length) {
			if (holder[0].firstChild && holder[0].firstChild.nodeValue) {
			    nice_id = holder[0].firstChild.nodeValue;
                        }
                    }
		}
	    }
	    if (call && call.onSuccess) {
		call.onSuccess (record_count, subject, is_onsip, nice_id);
	    }
	},
        onError   : function (status) {
	    if (call && call.onError) {
		call.onError();
	    }
	}
    });
};

ZENDESK._search = function (requester_id, call) {
    var xhr   = new XMLHttpRequest();
    var that  = this;
    var tmout = 10000;
    var ok    = false;

    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return false;
        }
        if (xhr.status !== 200) {
            if (call && call.onError) {
		dbg.log (that.log_context, 'Search ERROR');
                call.onError (xhr.status);
            }
        } else {
	    ok = true;
            if (call && call.onSuccess) {
		/** Uncomment to print out XML response from Zendesk service **/
                call.onSuccess (xhr.responseText);
            }
        }
    };

    var a = function () {
	that._abortXhr (xhr, ok, call, "search");
    }
    xhr.open ("GET", this.base_url + "/search.xml?query=requester:" + requester_id + '+order_by:created_at+sort:desc',
	      true,  this.user, this.pwd);
    dbg.log (this.log_context, 'SEND search request');
    setTimeout (a, tmout);
    xhr.send ();
};

ZENDESK.init      = function (pref) {
    this.base_url = pref.get ('zendeskUrl');
    this.user     = pref.get ('zendeskUsr');
    this.pwd      = pref.get ('zendeskPwd');
    this.attempts = 0;
    this.contacts = [];
    if (!(this.base_url && this.user && this.pwd)) {
	dbg.log (this.log_context, 'Init Failed ' + this.base_url);
	return;
    }
    if (this.to_id) {
        dbg.log (this.context, "Timeout set, clearing timeout from init ()");
        clearTimeout (this.to_id);
    }
    this.paginate = 1;
    var to_func, failed_to;
    var that = this;
    var f    = function () {
	if (that.paginate === -1) {
	    that.attempts = 0;
	    to_func       = that._recycle.bind (that);
	    that.to_id    = setTimeout (to_func, that.refresh);
	    return;
	}
	dbg.log (that.log_context, "init() Zendesk contacts");
        that._getContacts ({
            onSuccess : function (c) {
		dbg.log (that.log_context, 'Got contacts count ' + c.length + ' @ Page ' + that.paginate);
		setTimeout (f, 2000);
            },
            onError   : function (status) {
		dbg.log (that.log_context, 'Error ' + status);
		that.attempts += 1;
		to_func        = that._recycle.bind (that);
	        failed_to      = 60000 * that.attempts;
		that.to_id     = setTimeout (to_func, that.refresh);
		setTimeout (to_func, failed_to);
            }
        });
    };
    setTimeout (f, 2000);
};

ZENDESK._recycle  = function () {
    var to_func, failed_to;
    var that      = this;
    this.contacts = [];
    this.paginate = 1;
    if (this.to_id) {
	dbg.log (that.context, "Timeout set, clearing timeout");
	clearTimeout (this.to_id);
    }
    dbg.log (this.log_context, 'Recycle people');
    var f = function  () {
	if (that.paginate === -1) {
	    that.attempts = 0;
	    to_func       = that._recycle.bind (that);
	    that.to_id    = setTimeout (to_func, that.refresh);
	    return;
	}
	that._getContacts ({
	    onSuccess : function (c) {
		dbg.log (that.log_context, 'Recycled ' + c.length + ' contacts @ Page ' + that.paginate);
		setTimeout (f, 2000);
	    },
	    onError   : function (status) {
		that.attempts += 1;
		if (that.attempts <= 5) {
		    failed_to  = 60000 * that.attempts;
		    to_func    = that._recycle.bind (that);
		    that.to_id = setTimeout (to_func, failed_to);
		    dbg.log (that.log_context, 'Failed to connect on ' + that.attempts + ' attempts, will try again');
		} else {
		    dbg.log (that.log_context, 'CRITICAL FAILURE, tried to connect to API more than  5 time(s)');
		}
		dbg.log (that.log_context, 'Error ' + status);
	    }
	});
    };
    setTimeout (f, 2000);
};

ZENDESK._getContacts = function (call, page) {
    var xhr       = new XMLHttpRequest();
    var that      = this;
    var tmout     = 60000;
    var ok        = false;
    var usr_count = 0;
    xhr.onreadystatechange = function () {
	if (xhr.readyState !== 4) {
            return false;
	}
	if (xhr.status !== 200) {
            call.onError (xhr.status);
	} else {
	    ok = true;
	    that._parseContactsXML (xhr.responseText);
	    call.onSuccess (that.contacts);
	}
	return true;
    };
    var a = function () {
	that._abortXhr (xhr, ok, call, "getContacts");
    }
    xhr.open ("GET", this.base_url + '/users.xml?role=0&page=' + this.paginate, true, this.user, this.pwd);
    setTimeout (a, tmout);
    xhr.send ();
};

ZENDESK._parseContactsXML = function (xml) {
    var i, j, phone_node, phone, full_name, location, person_id;
    var xmlobject  = (new DOMParser()).parseFromString(xml, "text/xml");
    var root_node  = xmlobject.getElementsByTagName("users");
    if (root_node && root_node.length > 0) {
	root_node  = root_node[0];
    } else {
	return;
    }
    //dbg.log (this.log_context, xml);
    var user_count = 0, user_nodes, len;
    user_count = root_node.getAttribute ("count");
    user_nodes = root_node.getElementsByTagName("user");
    user_count = parseInt(user_count, 10);
    for (i = 0,len = user_nodes.length  ; i < len ; i += 1) {
	person_id     = user_nodes[i].getElementsByTagName ("id")[0].firstChild.nodeValue;
	full_name     = user_nodes[i].getElementsByTagName ("name");
	if (full_name && full_name.length > 0 && full_name[0].firstChild) {
	    full_name = full_name[0].firstChild.nodeValue;
	} else {
	    full_name = '-------';
	}
	phone_node    = user_nodes[i].getElementsByTagName ("phone");
	if (phone_node && phone_node.length && phone_node[0].firstChild) {
	    phone     = phone_node[0].firstChild.nodeValue;
	    dbg.log(this.log_context, "User " + full_name + " should have phone " + phone);
	    phone_num = this._normalizePhoneNumber (phone);
	    var person_obj = {
		"id"           : person_id,
		"full_name"    : full_name,
		"phone_number" : phone_num
	    };
	    if (phone_num) {
		this.contacts.push (person_obj);
	    }
	}
    }

    dbg.log (this.log_context, "User count " + user_count);
    if (user_count < 15) {
	this.paginate  = -1;
    } else {
	this.paginate += 1;
    }
};