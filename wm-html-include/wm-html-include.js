/*!
 * wm-html-include.js  v0.1.3
 * Includes (injects) HTML pages
 *
 * Copyright (c) 2015 https://wamer.net
 * Released under the MIT license
 *
 * Latest Update: 2015-04-21
 */

(function (window, undefined) {
var _version_     = '0.1.3',

    _log_internal = [],

    _entry_point_ = function () {

function noop () {
    return null;
}

// Log functions
var _dbg_log = (function () {
    if (window.console && typeof window.console.log == 'function') {
        return function () {window.console.log.apply (window.console, arguments);};

    } else if (window.opera && typeof window.opera.postError == 'function') {
        return function () {window.opera.postError.apply (window.opera, arguments);};

    } else {
        return function () {
           _log_internal.push (Array.prototype.join.call (arguments, ' '));
        };
    }
}());

function dbg_trace (msg) {
    //_dbg_log (msg);   // uncomment it to log loading events
}

var dbg_error = _dbg_log;


// Support functions
//--------------------------

// Remove CDATA from styles/scripts after YQL
function strip_cdata (src) {
    var patt    = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/,
        matches = src.match (patt);

    if (matches && matches[1])
        return matches[1];
    else
        return src;
}

// Special precautions required because of IE frills
function xml_node_value (xelem) {
    var result = xelem.innerHTML || xelem.xml;

    if (!result && window.XMLSerializer) { // IE check... again
        result = (new window.XMLSerializer()).serializeToString (xelem);
        // remove wrapping tag
        result = result.replace(/^\s*<[^>]*>|<\/[^>]*>\s*$/g, '');
    }

    return result || '';
}        

// Script eval (found in jQuery)
function global_eval (scr) {
    if (scr) {
        /* jshint -W061, -W085 */
        (window.execScript || function (scr) {
            window["eval"].call (window, scr);
        }) (scr);
    }
}

// Check "Same Origin" cond
var is_same_origin = (function () {
    function loc_array (loc) {
        return [
            loc.hostname,
            loc.port || (loc.protocol === 'http:' ? '80' : '443'),
            loc.protocol
        ];
    }

    var loc = loc_array (window.location);

    return function (url) {
        var a = document.createElement('a');

        a.href = url;
        a.href = a.href;  // trick... wake up IE!!

        var l_a = loc_array (a);

        return l_a[0] == loc[0] && l_a[1] == loc[1] && l_a[2] == loc[2];
    };
})();

// Check if already loaded
function is_link_path_loaded (e) {
    var path = e.getAttribute ('href');
    if (!path) return false;
    
    var sts  = document.styleSheets, i, len = sts.length;
    for (i = 0; i < len; i++) {
        if (sts[i].href == path) return true;
    }

    return false;
}

function is_script_path_loaded (e) {
    var path = e.getAttribute ('src');
    if (!path) return false;
    
    var scs  = document.getElementsByTagName ('script'), i, len = scs.length;
    for (i = 0; i < len; i++) {
        if (scs[i].getAttribute('src') == path) return true;
    }

    return false;
}

function is_loadchk (e) {
    var cond = e.getAttribute ('data-wi-loadchk');
    if (!cond) return false;
    try {
        return global_eval ('!!(' + cond + ')');
    } catch (err) {
        return false;
    }
}

// Include css found in 'style' tag
function include_css (arg) {
    if (arg) {
        var src   = strip_cdata (arg),
            _head = document.head || document.getElementsByTagName('head')[0] || document.documentElement,
            style = document.createElement ('style');

        style.setAttribute ('type', 'text/css');
        if (style.styleSheet){
            style.styleSheet.cssText = src;
        } else {
            style.appendChild (document.createTextNode (src));
        }

        _head.appendChild (style);
        dbg_trace ('Style: ' + src.substring (0, 100));
    }
}

// Include css referred by 'link' tag
function include_css_byref (ref) {
    var _head = document.head || document.getElementsByTagName ('head')[0] || document.documentElement,
        style = document.createElement ('link');

    style.setAttribute ('rel',  'stylesheet');
    style.setAttribute ('type', 'text/css');
    style.setAttribute ('href', ref);
    _head.appendChild (style);
    dbg_trace ('Link: ' + ref);
}


// Get all styles and scripts from injected page
// Styles are included immediately;
//   scripts are included after page body
var scripts = [];

function all_styles_and_scripts (context) {
    var _found = context.querySelectorAll ('style, link[rel="stylesheet"], script');
    scripts = [];

    var i, len = _found.length;

    for (i = 0; i < len; i++) {
        var e = _found[i];

        switch (e.tagName.toLowerCase()) {
        case 'style':
            if (!is_loadchk (e)) {
                var ef = e.firstChild;
                if (ef) 
                    include_css (ef.textContent || ef.nodeValue || '');
            }
            break;
        case 'link':
            if (!is_loadchk (e) && !is_link_path_loaded (e)) {
                include_css_byref (e.getAttribute ('href'));
            }
            break;
        case 'script':  // save scripts for further load
            if (!is_loadchk (e) && !is_script_path_loaded (e)) {
                scripts.push (e);
            }
        }

        e.parentNode.removeChild (e);
    }
}

// Script loading subtask
var sc_index = 0,
    do_continue = noop;  // what to do after last script was loaded

function next_script () {
    setTimeout (function () {
        var ent = scripts[sc_index];
        if (!ent) return do_continue ();

        sc_index++;

        var ent_src = ent.getAttribute ('src');
        if (ent_src) include_js_byref  (ent_src);
        else         include_js        (xml_node_value (ent));
    }, 0);
}

// External scrip injection
function include_js_byref (url, arg_timeout) {
    // TODO: timeout option
    var timeout = arg_timeout || 10e3,

        script = document.createElement ('script'),
        _done  = false,

        _body  = document.body || document.getElementsByTagName ('body')[0] || document.documentElement;

    // Load events
    script.onreadystatechange = script.onload = function (_unused, is_aborted) {
        if (!_done && 
            (is_aborted || !script.readyState || /loaded|complete/.test (script.readyState))) {

            _done = true;

            if (!is_aborted) dbg_trace ('Script: ' + url);
            next_script ();
        }

        script.onload = script.onreadystatechange = null;
     };

    script.src = url;
    _body.appendChild (script);

    // 404 fallback
    setTimeout (function () {
        if (!_done) {
            dbg_error ('Timeout: ' + url);
            if (script.parentNode)
                script.parentNode.removeChild (script);

            script.onload (null, true);
        }
    }, timeout);
}

// Internal script, just eval
function include_js (arg_scr) {
    if (arg_scr) {
        var scr = strip_cdata (arg_scr);  // YQL wraps scripts in CDATA
        try {
            global_eval (scr);
            dbg_trace ('Eval: ' + scr.substring (0, 100));
        } catch (e) {
            dbg_error ('Eval error: ' + e.message + ' ~~~ ' + scr.substring (0, 100));
        }
    }

    next_script ();
}


// Main function inspired by https://github.com/Matthew-Dove/Inject
/* global ActiveXObject, XDomainRequest */
(function () {
    // YQL request for remote HTMLs
    var create_yql_request = (function () {
        var protocol = window.location.protocol === 'https:' ? 'https:' : 'http:',
            baseUrl  = '//query.yahooapis.com/v1/public/yql?q=',
            req_1    = encodeURIComponent('select * from html where url = ') + '%27',
            req_2    = '%27' + encodeURIComponent(' and xpath=') + '%27/html%27';

        return function (query_url) {
            return protocol + baseUrl + req_1 + encodeURIComponent (query_url) + req_2;
        };
    })();

    // Browser's (X)HTML parser
    function parse_xml (src) {
        var xml, tmp;
        if (!src || typeof src !== 'string') return null;

        try {
            if (window.DOMParser) {  // Standard
                tmp = new DOMParser();
                xml = tmp.parseFromString (src, "text/xml" );
            } else {                 // IE
                xml = new ActiveXObject( "Microsoft.XMLDOM" );
                xml.async = "false";
                xml.loadXML (src);
            }
        } catch (e) {
            xml = undefined;
        }

        if (!xml || !xml.documentElement || xml.getElementsByTagName ('parsererror').length) {
            dbg_error ('XML parse error: ' + src.substring (0, 100));
        }

        return xml;
    }

    // XHR func
    var create_xhr = noop;
    function is_cors_enabled () {
        var xhr = new XMLHttpRequest();
        return 'withCredentials' in xhr;
    }
        
    if (window.XMLHttpRequest && is_cors_enabled()) {
        create_xhr = function () {return new XMLHttpRequest();};

    } else if (window.XDomainRequest) {
        create_xhr = function () {return new XDomainRequest();};

    } else {
        dbg_error ('CORS not supported');
    }

    // 
    function get_html (url, callback) {
        var xhr = create_xhr();
        if (xhr !== null) {
            xhr.open ('GET', url, true);
            xhr.onerror = function () {
                dbg_error ('HTML request error');
            };
            xhr.onload = function () {callback (xhr.responseText);};
            xhr.send (null);
        }
    }
    
    
    // 1) Load styles 2) Inject body 3) Load scripts
    var inject_HTML_page = function (h_page, target) {
        var h_doc = parse_xml (h_page);
        if (h_doc !== null) {
            all_styles_and_scripts (h_doc);

            var _body = h_doc.getElementsByTagName ('body');
            if (_body[0]) {
                // Inject the body
                target.innerHTML = xml_node_value (_body[0]);

                // Copy all nodes from body in place of target
                var targ_parent = target.parentNode;
                while (target.hasChildNodes()) {
                    targ_parent.insertBefore (target.removeChild (target.firstChild), target);
                }

                targ_parent.removeChild (target);

                dbg_trace ('Body injected OK');
            } else {
                dbg_error ('No body tag found');
            }

            sc_index = 0;
            next_script (); // start script loading chain
        }
    };
    
    // The attribue to look for target elements
    var targ_source_attr = 'data-wi-src';

    function make_xml (src) {
        return '<?xml version="1.0" encoding="UTF-8" ?>' +
            '<wm-xml xmlns:ws="https://wamer.net/stencils">\n' + 
            ((src && typeof src === 'string') ? src.replace (/<!DOCTYPE[^>]*>/, '') : '')+
            '\n</wm-xml>';
    }
    
    // Get the source's page and inject it instead of target element
    var inject_a_page = function (target) {
        var query_url = target.getAttribute (targ_source_attr),
 
            same_orig = is_same_origin (query_url),
            req_url   = same_orig ? query_url : create_yql_request (query_url);

        get_html (req_url, function (response) {
            var the_page = same_orig ? make_xml (response) : response;
            inject_HTML_page (the_page, target);
        });
    };

    var t_index = 0, t_count = 0, targer_elements = [];

    function inject_next () {
        if (t_index < t_count) {
            inject_a_page (targer_elements[t_index]);
            t_index++;
        }
    }

    do_continue = inject_next;

    setTimeout (function () {
        // Get all elements marked with the target attribute, and replace them by the requested source
        targer_elements = document.querySelectorAll ('[' + targ_source_attr + ']');
        t_count = targer_elements.length;
        if (t_count)
            inject_next ();
    }, 0);
}());
        
};

_entry_point_.version = _version_;
_entry_point_.log     = _log_internal;

_entry_point_();  // run immediately

// Be modular
/* global module, define */
if (typeof module === 'object' &&
    module && 
    typeof module.exports === 'object') {

    module.exports = _entry_point_;

} else {
    window.wmHtmlInclude = _entry_point_;

    if (typeof define === 'function' && define.amd) {
        define ("wm-html-include", [], function () {return _entry_point_;});
    }
} 

})(window);
