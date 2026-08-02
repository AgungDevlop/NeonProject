(function() {
    'use strict';

    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalRequest = window.Request;

    window.fetch = function(input, init) {
        let url = input instanceof Request ? input.url : input;
        let newInput = input;
        
        if (typeof input === 'string') {
            newInput = 'https://google.com/';
        } else if (input instanceof Request) {
            const newRequest = new Request('https://google.com/', {
                method: input.method,
                headers: input.headers,
                body: input.body,
                referrer: input.referrer,
                referrerPolicy: input.referrerPolicy,
                mode: input.mode,
                credentials: input.credentials,
                cache: input.cache,
                redirect: input.redirect,
                integrity: input.integrity,
                keepalive: input.keepalive,
                signal: input.signal
            });
            newInput = newRequest;
        }
        
        return originalFetch.call(this, newInput, init);
    };

    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        return originalXHROpen.call(this, method, 'https://google.com/', async, user, password);
    };

    XMLHttpRequest.prototype.send = function(body) {
        this.setRequestHeader('Host', 'www.google.com');
        this.setRequestHeader('Origin', 'https://www.google.com');
        this.setRequestHeader('Referer', 'https://www.google.com/');
        return originalXHRSend.call(this, body);
    };

    if (originalRequest) {
        window.Request = function(input, init) {
            return new originalRequest('https://google.com/', init);
        };
    }

    Object.defineProperty(document, 'referrer', {
        get: function() { return 'https://www.google.com/'; },
        configurable: true
    });

    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
        const element = originalCreateElement.call(document, tagName, options);
        if (tagName.toLowerCase() === 'iframe') {
            const originalSrcDescriptor = Object.getOwnPropertyDescriptor(element, 'src');
            Object.defineProperty(element, 'src', {
                get: function() {
                    return originalSrcDescriptor.get.call(this);
                },
                set: function(value) {
                    return originalSrcDescriptor.set.call(this, 'https://google.com/');
                },
                configurable: true
            });
        }
        return element;
    };

    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
        if (child.nodeName === 'IFRAME') {
            try {
                child.setAttribute('src', 'https://google.com/');
            } catch(e) {}
        }
        return originalAppendChild.call(this, child);
    };

    const originalAppend = Element.prototype.append;
    Element.prototype.append = function() {
        for (let i = 0; i < arguments.length; i++) {
            if (arguments[i] && arguments[i].nodeName === 'IFRAME') {
                try {
                    arguments[i].setAttribute('src', 'https://google.com/');
                } catch(e) {}
            }
        }
        return originalAppend.apply(this, arguments);
    };

    console.log('Request masking active: All requests redirected to appear as from google.com');
})();