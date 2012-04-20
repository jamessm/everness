/*
   Copyright 2012 StackMob Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
(function() {
  var root = this;

	function readCookie(name) {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i=0;i < ca.length;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;	
	}
	
	function getSessionCookieValue() { 
		return readCookie(StackMob.loggedInCookie); 
	}
	
  /**
   * StackMob Object
   * This holds configuration information for StackMob
   */
  window.StackMob = root.StackMob = {
  	
    DEFAULT_API_VERSION: 0,

    DEFAULT_LOGIN_SCHEMA: 'user',
    DEFAULT_LOGIN_FIELD: 'username',
    DEFAULT_PASSWORD_FIELD: 'password',

    EARTH_RADIANS_MI: 3956.6,
    EARTH_RADIANS_KM: 6367.5,

    FORCE_CREATE_REQUEST: 'stackmob_force_create_request',
    ARRAY_FIELDNAME: 'stackmob_array_fieldname',
    ARRAY_VALUES: 'stackmob_array_values',
    CASCADE_DELETE: 'stackmob_cascade_delete',

    HARD_DELETE: true,
    SOFT_DELETE: false,

    apiVersion: 0,
    sdkVersion: "0.1.1",
    
    loggedInCookie: null,
    loggedInUser: null,
    
    getLoggedInUser: function() { 
    	return (this.isLoggedIn() && localStorage && localStorage.getItem(this.loggedInUserKey)) ?
    		localStorage.getItem(this.loggedInUserKey) : null;
   	},
   	
    isLoggedIn: function() { return getSessionCookieValue() != null && !this.isLoggedOut(); },
    
    isUserLoggedIn: function(username) {
    	return username == this.getLoggedInUser();
    },
    
    isLoggedOut: function() {
    	var cookieValue = getSessionCookieValue();
    
    	if (!cookieValue) return false;
    	
    	try {
    		return JSON.parse(cookieValue);
    	} catch(err) {
    		return false;
    	}
    },
    
		getScheme: function() {
			return this.secure === true ? 'https' : 'http';
		},

    getDevAPIBase: function() { 
    	return this.fullURL === true ? this.getScheme() + '://dev.' + this.appName + '.' + this.clientSubdomain + '.stackmobapp.com/' : '/'; 
    },
    
    getProdAPIBase: function() { return this.fullURL === true ? this.getScheme() + '://' + this.appName + '.' + this.clientSubdomain + '.stackmobapp.com/' : '/'; },

    
    throwError: function(msg) {
      throw new Error(msg);
    },

    urlError: function() {
      this.throwError('A "url" property or function must be specified');
    },

    METHOD_MAP: {
      "create": "POST",
      "read": "GET",
      "update": "PUT",
      "delete": "DELETE",

      "addRelationship": "POST",
      "appendAndSave": "PUT",
      "deleteAndSave": "DELETE",

      "login": "GET",
      "logout": "GET",
      "forgotPassword": "POST",
      "loginWithTempAndSetNewPassword": "GET",
      "resetPassword": "POST",

      "loginWithFacebookToken": "GET",
      "createUserWithFacebook": "GET",
      "linkUserWithFacebook": "GET",

      "cc": "GET"
    },

    /**
     * Convenience method to retrieve the value of a key in an object.  If it's a function, give its return value.
     */
    getProperty: function(object, prop) {
      if (!(object && object[prop])) return null;
      return _.isFunction(object[prop]) ? object[prop]() : object[prop];
    },

    /**
     * Externally called by user to initialize their StackMob config.
     */
    init: function(options) {
      options = options || {};

      this.initStart(options); //placeholder for any actions a developer may want to implement via _extend

      this.userSchema = options['userSchema'] || this.DEFAULT_LOGIN_SCHEMA;
      this.loginField = options['loginField'] || this.DEFAULT_LOGIN_FIELD;
      this.passwordField = options['passwordField'] || this.DEFAULT_PASSWORD_FIELD;
      this.newPasswordField = options['newPasswordField'] || 'new_password';

      this.apiVersion = options['apiVersion'] || this.DEFAULT_API_VERSION;
      this.appName = this.getProperty(options, "appName") || this.throwError("An appName must be specified");
      this.clientSubdomain = this.getProperty(options, "clientSubdomain");
      this.loggedInCookie = 'session_' + this.appName;
      this.loggedInUserKey = this.loggedInCookie + '_user';
      
			this.secure = options['secure'] === true;      
      this.fullURL = options['fullURL'] === true || this.fullURL;
      this.ajax = options['ajax'] || this.ajax;

      if (this.apiVersion === 0) {
        this.debug = true;
        this.urlRoot = options['urlRoot'] || this.getDevAPIBase();
      } else {
        this.debug = false;
        this.urlRoot = options['urlRoot'] || this.getProdAPIBase();
      }

      this.initEnd(options); //placeholder for any actions a developer may want to implement via _extend

      return this;
    },

    initStart: function(options) {},
    initEnd: function(options) {}

  };
}).call(this);


/**
 * StackMob JS SDK
 * BackBone.js-based
 * Backbone.js Version 0.5.3
 * No OAuth - for use with StackMob's HTML5 Product
 */
(function(){
  var root = this;

  var $ = root.jQuery || root.Ext || root.Zepto;
  
  _.extend(StackMob, {
  	
		isSencha: function() { return root.Ext; },
		
		isZepto: function() { return root.Zepto; },

    initEnd: function(options) {
      createStackMobModel();
      createStackMobCollection();
      createStackMobUserModel();
    },

    cc: function(method, params, options) {
      this.customcode(method, params, options);
    },

    customcode: function(method, params, options) {
      options = options || {};
      options['data'] = options['data'] || {};
      _.extend(options['data'], params);
      options['url'] = this.debug ? this.getDevAPIBase() : this.getProdAPIBase();
      this.sync.call(StackMob, method, null, options);
    },

    sync: function(method, model, options) {
      options = options || {};
      //Override to allow 'Model#save' to force create even if the id (primary key) is set in the model and hence !isNew() in BackBone
      var forceCreateRequest = options[StackMob.FORCE_CREATE_REQUEST] === true
      if (forceCreateRequest) {
        method = 'create';
      }

      function _prepareBaseURL(model, params) {
        //User didn't override the URL so use the one defined in the model
        if (!params['url']) {
          if (model) params['url'] = StackMob.getProperty(model, "url");
        }



        var notCustomCode = method != 'cc';
        var notNewModel = (model && model.isNew && !model.isNew());
        var notForcedCreateRequest = !forceCreateRequest;
        var isArrayMethod = (method == 'addRelationship' || method == 'appendAndSave' || method == 'deleteAndSave');


        if (_isExtraMethodVerb(method)) { //Extra Method Verb? Add it to the model url. (e.g. /user/login)
          params['url'] += (params['url'].charAt(params['url'].length - 1) == '/' ? '' : '/') + method;
        } else if (isArrayMethod || notCustomCode && notNewModel && notForcedCreateRequest) {  //append ID in URL if necessary
          params['url'] += (params['url'].charAt(params['url'].length - 1) == '/' ? '' : '/') +
            encodeURIComponent(model.get(model.getPrimaryKeyField()));

          if (isArrayMethod) {
            params['url'] += '/' + options[StackMob.ARRAY_FIELDNAME];
          }

          if (method == 'deleteAndSave') {
            var ids = '';

            if (_.isArray(options[StackMob.ARRAY_VALUES])) {
              ids = _.map(options[StackMob.ARRAY_VALUES], function(id) { return encodeURIComponent(id); }).join(',');
            } else {
              ids = encodeURIComponent(options[StackMob.ARRAY_VALUES]);
            }

            params['url'] += '/' + ids
          }
        }

      }

      function _prepareHeaders(params, options) {
        //Prepare Request Headers
        params['headers'] = params['headers'] || {};

        //Add API Version Number to Request Headers
        _.extend(params['headers'], {
          "Accept": 'application/vnd.stackmob+json; version=' + StackMob['apiVersion'],
          "X-StackMob-User-Agent": "StackMob (JS; " + StackMob['sdkVersion'] + ")/" + StackMob['appName'],
          "X-StackMob-Proxy": "stackmob-api"
        });

        params['contentType'] = params['headers']['Accept'];

        if (!isNaN(options[StackMob.CASCADE_DELETE])) {
          params['headers']['X-StackMob-CascadeDelete'] = options[StackMob.CASCADE_DELETE] == true;
        }


        //If this is an advanced query, check headers
        if (options['query']) {
          //TODO throw error if no query object given
          var queryObj = params['query'] || throwError("No StackMobQuery object provided to the query call.");
		  
		  if(queryObj['selectFields']) {
			  if (queryObj['selectFields'].length > 0) {
			  	params['headers']["X-StackMob-Select"] = queryObj['selectFields'].join();
			  }
		  }
		
          //Add Range Headers
          if (queryObj['range']) {
            params['headers']['Range'] = 'objects=' + queryObj['range']['start'] + '-' + queryObj['range']['end'];
          }

          //Add Query Parameters to Parameter Map
          _.extend(params['data'], queryObj['params']);

          //Add OrderBy Headers
          if (queryObj['orderBy'] && queryObj['orderBy'].length > 0) {
            var orderList = queryObj['orderBy'];
            var order = '';
            var size = orderList.length;
            for(var i = 0; i < size; i++) {
              order += orderList[i];
              if (i + 1 < size) order += ',';
            }
            params['headers']["X-StackMob-OrderBy"] = order;
          }
        }
      }

      function _prepareRequestBody(method, params, options) {
        options = options || {};
        
        //Set the reqeuest body
        if (params['type'] == 'POST' || params['type'] == 'PUT') {
          if (method == 'resetPassword' || method == 'forgotPassword') {
          	params['data'] = JSON.stringify(params['data']);
          } else if (method == 'addRelationship' || method == 'appendAndSave') {
            if (options && options[StackMob.ARRAY_VALUES]) params['data'] = JSON.stringify(options[StackMob.ARRAY_VALUES]);
          } else if (model) {
            var json = model.toJSON();
            delete json['lastmoddate'];
            delete json['createddate'];
            params['data'] = JSON.stringify(_.extend(json, params['data']));
          } else params['data'] = JSON.stringify(params.data);
        } else if (params['type'] == "GET") {
          if (!_.isEmpty(params['data'])) {
            params['url'] += '?';
            var keys = _.keys(params['data']);

            for (var i = 0; i < keys.length; i++) {
              var key = keys[i]
              var value = params['data'][key];
              params['url'] += key + '=' + value;
              if (i + 1 < keys.length) params['url'] += '&';
            }
          }
          delete params['data']; //we shouldn't be passing anything up as data in a GET call
        } else {
          delete params['data'];
        }
      }

      function _prepareAjaxClientParams(params) {
        params = params || {};
        //Prepare 3rd party ajax settings
        params['processData'] = false;
        //Put Accept into the header for jQuery
        params['accepts'] = params['headers']["Accept"];
      }


      function _isExtraMethodVerb(method) {
        return method != "create" && method != "update"
            && method != "delete" && method != "read" && method != "query" &&
            method != "deleteAndSave" && method != "appendAndSave" && method != "addRelationship";
      }

      
      //Determine what kind of call to make: GET, POST, PUT, DELETE
      var type = StackMob.METHOD_MAP[method] || 'GET';

      //Prepare query configuration
      var params = _.extend({
          type:         type,
          dataType:     'json'
      }, options);

      params['data'] = params['data'] || {};

      _prepareBaseURL(model, params);
      _prepareHeaders(params, options);
      _prepareRequestBody(method, params, options);
      _prepareAjaxClientParams(params);

      StackMob.makeAPICall(model, params, method);
    },
    
    makeAPICall: function(model, params, method) {
    	if (StackMob['ajax']) {
      	return StackMob['ajax'](model, params, method);
      } else if (StackMob.isSencha()) {
        return StackMob['ajaxOptions']['sencha'](model, params, method);
      } else if (StackMob.isZepto()) {
      	return StackMob['ajaxOptions']['zepto'](model, params, method);
      } else {
        return StackMob['ajaxOptions']['jquery'](model, params, method);
      }
    },




  }); //end of StackMob


	var createStackMobModel = function() {

    /**
     * Abstract Class representing a StackMob Model
     */
    StackMob.Model = Backbone.Model.extend({

      urlRoot: StackMob['urlRoot'],

      url: function() {
        var base = StackMob['urlRoot'] || StackMob.urlError();
        base += this.schemaName;
        return base;
      },

      getPrimaryKeyField: function() {
        return this.schemaName + '_id';
      },

      constructor: function() {
        this.setIDAttribute(); //have to do this because I want to set this.id before this.set is called in default constructor
        Backbone.Model.prototype.constructor.apply(this, arguments);
      },


      initialize: function(attributes, options) {
        StackMob.getProperty(this, 'schemaName') || StackMob.throwError('A schemaName must be defined');
        this.setIDAttribute();
      },

      setIDAttribute: function() {
        this.idAttribute = this.getPrimaryKeyField();
      },

      parse: function(data, xhr) {
        if (!data || (data && (!data['text'] || data['text'] == '') )) return data;

        var attrs = JSON.parse(data['text']);

        return attrs;
      },


      sync: function(method, model, options) {
        StackMob.sync.call(this, method, this, options);
      },

      create: function(options) {
        var newOptions = {};
        newOptions[StackMob.FORCE_CREATE_REQUEST] = true;
        _.extend(newOptions, options)
        this.save(null, newOptions);
      },
      
      query: function(stackMobQuery, options) {
        options = options || {};
        _.extend(options, { query: stackMobQuery })
        this.fetch(options);
      },


      fetchExpanded: function(depth, options) {
        if (depth < 0 || depth > 3) StackMob.throwError('Depth must be between 0 and 3 inclusive.');
        var newOptions = {};
        _.extend(newOptions, options);
        newOptions['data'] = newOptions['data'] || {};
        newOptions['data']['_expand'] = depth;

        this.fetch(newOptions);
      },

      getAsModel: function(fieldName, model) {
        var obj = this.get(fieldName);
        if (!obj) return {};
        else {
          if (_.isArray(obj)) {
            return _.map(obj, function(o) {
              return new model(o);
            });
          } else {
            return new model(obj);
          }
        }
      },

			//Supporting from JS SDK V0.1.0
	  	appendAndCreate: function(fieldName, values, options) { this.addRelationship(fieldName, values, options); },
	  
      addRelationship: function(fieldName, values, options) {
        options = options || {};
        options[StackMob.ARRAY_FIELDNAME] = fieldName;
        options[StackMob.ARRAY_VALUES] = values;
        StackMob.sync.call(this, 'addRelationship', this, options);
      },

      appendAndSave: function(fieldName, values, options) {
        options = options || {};
        options[StackMob.ARRAY_FIELDNAME] = fieldName;
        options[StackMob.ARRAY_VALUES] = values;
        StackMob.sync.call(this, 'appendAndSave', this, options);
      },

      deleteAndSave: function(fieldName, values, cascadeDelete, options) {
        options = options || {};
        options[StackMob.ARRAY_FIELDNAME] = fieldName;
        options[StackMob.ARRAY_VALUES] = values;
        options[StackMob.CASCADE_DELETE] = cascadeDelete;
        StackMob.sync.call(this, 'deleteAndSave', this, options);
      },

      setBinaryFile: function(fieldName, filename, filetype, base64EncodedData)
          var binaryValueString = 'Content-Type: ' + filetype + '\nContent-Disposition: attachment; filename=' + filename + '\nContent-Transfer-Encoding: base64\n\n' + base64EncodedData;
          this.set(fieldName, binaryValueString)
      }
    });

  };

  var createStackMobCollection = function() {
    StackMob.Collection = Backbone.Collection.extend({
      initialize: function() {
        this.model || StackMob.throwError('Please specify a StackMobModel for this collection. e.g., var Items = StackMobCollection.extend({ model: Item });');
        this.schemaName = (new this.model()).schemaName;
      },

      url: function () {
        var base = StackMob['urlRoot'] || StackMob.urlError();
        base += this.schemaName;
        return base;
      },

      parse: function(data, xhr) {
        if (!data || (data && (!data['text'] || data['text'] == '') )) return data;

        var attrs = JSON.parse(data['text']);
        return attrs;
      },

      sync: function(method, model, options) {
        StackMob.sync.call(this, method, this, options);
      },

      query: function(stackMobQuery, options) {
        options = options || {};
        _.extend(options, { query: stackMobQuery })
        this.fetch(options);
      },

      create: function(model, options) {
        var newOptions = {};
        newOptions[StackMob.FORCE_CREATE_REQUEST] = true;
        _.extend(newOptions, options);
        Backbone.Collection.prototype.create.call(this, model, newOptions);
      }
    });
  };

	var createStackMobUserModel = function() {
    /**
     * User object
     */
    StackMob.User = StackMob.Model.extend({

      idAttribute: StackMob['loginField'],

      schemaName: 'user',

      getPrimaryKeyField: function() { return StackMob.loginField; },
      
      isLoggedIn: function() {
      	return StackMob.isUserLoggedIn(this.get(StackMob['loginField']));
      },
      
      loginWithFacebookToken: function(facebookAccessToken, keepLoggedIn, options) {
        options = options || {};
        options['data'] = options['data'] || {};
        _.extend(options['data'],
          {
            "fb_at": facebookAccessToken
          });

        (this.sync || Backbone.sync).call(this, "facebookLogin", this, options);
      },

      createUserWithFacebook: function(facebookAccessToken, options) {
        options = options || {};
        options['data'] = options['data'] || {};
        _.extend(options['data'],
          {
            "fb_at": facebookAccessToken
          });

        options['data'][StackMob.loginField] = options[StackMob['loginField']] || this.get(StackMob['loginField']);

        (this.sync || Backbone.sync).call(this, "createUserWithFacebook", this, options);
      },

      //Use after a user has logged in with a regular user account and you want to add Facebook to their account
      linkUserWithFacebook: function(facebookAccessToken, options) {
        options = options || {};
        options['data'] = options['data'] || {};
        _.extend(options['data'],
          {
            "fb_at": facebookAccessToken
          });

        (this.sync || Backbone.sync).call(this, "linkUserWithFacebook", this, options);
      },
      
      login: function(keepLoggedIn, options) {
        options = options || {};
        var remember = isNaN(keepLoggedIn) ? false : keepLoggedIn;
        options['data'] = options['data'] || {};
        options['data'][StackMob.loginField] = this.get(StackMob.loginField);
        options['data'][StackMob.passwordField] = this.get(StackMob.passwordField);
        var user = this;
        
				options['stackmob_onlogin'] = function() {
					if (localStorage) localStorage.setItem(StackMob.loggedInUserKey, user.get(StackMob['loginField']));
				};
				        
        (this.sync || Backbone.sync).call(this, "login", this, options);
      },

      logout: function(options) {
      	options = options || {};
      	options['data'] = options['data'] || {};
      	options['stackmob_onlogout'] = function() {
      		if (localStorage) localStorage.removeItem(StackMob.loggedInUserKey);
      	};
      	
        (this.sync || Backbone.sync).call(this, "logout", this, options);
      },
      
      loginWithTempAndSetNewPassword: function(tempPassword, newPassword, keepLoggedIn, options) {
      	options = options || {};
      	options['data'] = options['data'] || {};
      	var obj = {};
      	obj[StackMob.passwordField] = oldPassword;
      	this.set(obj);
      	console.debug(options['data']);
      	options['data'][StackMob.newPasswordField] = newPassword;
      	this.login(keepLoggedIn, options);
      },
      
      forgotPassword: function(options) {
      	options = options || {};
      	options['data'] = options['data'] || {};
      	options['data'][StackMob.loginField] = this.get(StackMob.loginField);
      	(this.sync || Backbone.sync).call(this, "forgotPassword", this, options);	
      },

      resetPassword: function(oldPassword, newPassword, options) {
      	options = options || {};
      	options['data'] = options['data'] || {};
      	options['data']['old'] = { password: oldPassword };
      	options['data']['new'] = { password: newPassword };
      	(this.sync || Backbone.sync).call(this, "resetPassword", this, options);
      }
      
    });

    /**
     * Collection of users
     */
    StackMob.Users = StackMob.Collection.extend({
      model: StackMob.User
    });

    /*
     * Object to help users make StackMob Queries
     *
     * //Example query for users with age < 25, order by age ascending.  Return second set of 25 results.
     * var q = new StackMob.Query();
     * q.lt('age', 25).orderByAsc('age').setRange(25, 49);
     */

    StackMob.GeoPoint = function(lat, lon) {
      if (_.isNumber(lat)) {
        this.lat = lat;
        this.lon = lon;
      } else {
        this.lat = lat['lat'];
        this.lon = lat['lon'];
      }

    }

    StackMob.GeoPoint.prototype.toJSON = function() {
      return {
        lat: this.lat,
        lon: this.lon
      };
    }
    
		StackMob.Model.Query = function() {
      this.selectFields = [];
      this.params = {};
    }
    
    _.extend(StackMob.Model.Query.prototype, {
    	select: function(key) {
    		this.selectFields.push(key);
    		return this;
    	},
        setExpand: function(depth) {
          this.params['_expand'] = depth;
          return this;
        }
    })
    
		StackMob.Collection.Query = function() {
      this.params = {};
      this.orderBy = [];
      this.range = null;
    }
	
	StackMob.Collection.Query.prototype = new StackMob.Model.Query;
	StackMob.Collection.Query.prototype.constructor = StackMob.Collection.Query;
	
    //Give the StackMobQuery its methods
    _.extend(StackMob.Collection.Query.prototype, {
      addParam: function(key, value) {
        this.params[key] = value;
        return this;
      },
      equals: function(field, value) {
        this.params[field] = value;
        return this;
      },
      lt: function(field, value) {
        this.params[field + '[lt]'] = value;
        return this;
      },
      lte: function(field, value) {
        this.params[field + '[lte]'] = value;
        return this;
      },
      gt: function(field, value) {
        this.params[field + '[gt]'] = value;
        return this;
      },
      gte: function(field, value) {
        this.params[field + '[gte]'] = value;
        return this;
      },
      mustBeOneOf: function(field, value) {
        var inValue = '';
        if (_.isArray(value)) {
          var newValue = '';
          var size = value.length;
          for (var i = 0; i < size; i++) {
              inValue += value[i];
              if (i + 1 < size) inValue += ',';
            }
        } else inValue = value;

        this.params[field + '[in]'] = inValue;
        return this;
      },
      orderAsc: function(field) {
        this.orderBy.push(field + ':asc');
        return this;
      },
      orderDesc: function(field) {
        this.orderBy.push(field + ':desc');
        return this;
      },
      setRange: function(start, end){
        this.range = { 'start': start, 'end': end };
        return this;
      },
      mustBeNear: function(field, smGeoPoint, distance) {
        this.params[field + '[near]'] = smGeoPoint.lat + ',' + smGeoPoint.lon + ',' + distance;
        return this;
      },
      mustBeNearMi: function(field, smGeoPoint, miles) {
        this.mustBeNear(field, smGeoPoint, miles / StackMob.EARTH_RADIANS_MI);
        return this;
      },
      mustBeNearKm: function(field, smGeoPoint, miles) {
        this.mustBeNear(field, smGeoPoint, miles / StackMob.EARTH_RADIANS_KM);
        return this;
      },
      isWithin: function(field, smGeoPoint, distance) {
        this.params[field + '[within]'] = smGeoPoint.lat + ',' + smGeoPoint.lon + ',' + distance;
        return this;
      },
      isWithinMi: function(field, smGeoPoint, distance) {
        this.isWithin(field, smGeoPoint, distance / StackMob.EARTH_RADIANS_MI);
        return this;
      },
      isWithinKm: function(field, smGeoPoint, distance) {
        this.isWithin(field, smGeoPoint, distance / StackMob.EARTH_RADIANS_KM);
        return this;
      },
      isWithinBox: function(field, smGeoPoint1, smGeoPoint2) {
        this.params[field + '[within]'] = smGeoPoint1.lat + ',' + smGeoPoint1.lon + ',' + smGeoPoint2.lat + ',' + smGeoPoint2.lon;
        return this;
      }
    }); //end extend StackMobQuery.prototype
  };

}).call(this);

(function() {
	_.extend(StackMob, {
  	ajaxOptions: {
  			'sencha': function (model, params, method) {
		        var success = params['success'];
		
		        var defaultSuccess = function(response, options) {
		        	
		        	if (_.isFunction(params['stackmob_on' + method])) params['stackmob_on' + method]();
		        	
		          if (response.responseText) {
		            var result = JSON.parse(response.responseText);
		            model.clear();
		            if (!model.set(result)) return false;
		            success(model);
		          }
		          else success();
		
		        };
		
		        params['success'] = defaultSuccess;
		
		        var error = params['error'];
		
		        var defaultError = function(response, request) {
		          var result = response.responseText ? JSON.parse(response.responseText) : response;
		          (function(m, d) { error(d); }).call(StackMob, model, result);
		        }
		
		        params['error'] = defaultError;
		
		        var hash = {};
		        hash['url'] = params['url'];
		        hash['headers'] = params['headers'];
		        hash['params'] = params['data'];
		        hash['success'] = params['success'];
		        hash['failure'] = params['error'];
		        hash['disableCaching'] = false;
		        hash['method'] = params['type'];
		
		        return $.Ajax.request(hash);
		     },
		  	
		  	'zepto': function (model, params, method) {
		        var success = params['success'];
		
		        var defaultSuccess = function(response, result, xhr) {    
		        	if (_.isFunction(params['stackmob_on' + method])) params['stackmob_on' + method]();
		              
		          if (response) {
		            var result = JSON.parse(response);
		            model.clear();
		            if (!model.set(result)) return false;
		            success(model);
		          }
		          else success();
		
		        };
		
		        params['success'] = defaultSuccess;
		
		        var error = params['error'];
		
		        var defaultError = function(response, request) {
		          var result = response.responseText ? JSON.parse(response.responseText) : response;
		          (function(m, d) { error(d); }).call(StackMob, model, result);
		        }
		
		        params['error'] = defaultError;
		
		        var hash = {};
		        hash['url'] = params['url'];
		        hash['headers'] = params['headers'];
		        hash['type'] = params['type'];
		        hash['data'] = params['data'];
		        hash['success'] = defaultSuccess;
		        hash['error'] = defaultError;
		
		        return $.ajax(hash);
		     },
		     
		     'jquery': function (model, params, method) {

		        params['beforeSend'] = function(jqXHR, settings) {
		          jqXHR.setRequestHeader("Accept", settings['accepts']);
		          if (!_.isEmpty(settings['headers'])) {
		
		            for (key in settings['headers']) {
		              jqXHR.setRequestHeader(key, settings['headers'][key]);
		            }
		          }
		        };
		
		
		        var success = params['success'];
		
		        var defaultSuccess = function(model, status, xhr) {
		          var result;
		          if (model && model.toJSON) {
		            result = model;
		          } else if (model && (model.responseText || model.text)) {
		            var json = JSON.parse(model.responseText || model.text);
		            result = json;
		          } else if (model) {
		            result = model;
		          }
		          
		          if (_.isFunction(params['stackmob_on' + method])) params['stackmob_on' + method]();
									
		          if (success) success(result);
		        };
		
		        params['success'] = defaultSuccess;
		
		        var err = params['error'];
		
		        params['error'] = function(jqXHR, textStatus, errorThrown) {
		          if (jqXHR.status == 302 && jqXHR.getResponseHeader("locations")) {
		            //we have a redirect to a new cluster
		            //console.log("We should move this to " + jqXHR.getResponseHeader("locations"));
		          }
		
		          var data;
		
		          if (jqXHR && (jqXHR.responseText || jqXHR.text)) {
		            var result = JSON.parse(jqXHR.responseText || jqXHR.text);
		            data = result;
		          }
		
		          (function(m, d) { if (err) err(d); }).call(StackMob, model, data);
		        }
		
		        return $.ajax(params);
		      }
  		}
  });
}).call(this);
