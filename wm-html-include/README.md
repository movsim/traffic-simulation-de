# wm-html-include.js

is a small *script* to include external HTML page(s) into comprising HTML page.  
A part of  [Wamer project](http://www.wamer.net/)


## When to use it

If you need to compose a Web page on client-side, but either iframes or [HTML Imports]( http://www.w3.org/TR/2013/WD-html-imports-20130514) are not suitable to the case.  
One most likely may need it to:  
quickly sew Web page from some existing or newly developed small parts (components);  
patch existing Web page not changing significantly its content.


## How to use it

### Static links

```html
<!-- Any tag with reference to another HTML, may be another... -->
<div data-wi-src="http://another.domain/component-1.html"> </div>
<!-- ... -->
<!-- ... or the same domain -->
<span data-wi-src="component-2.html"> </span>
<!-- ... -->
<!-- It may even looks almost like W3C "import" -->
<link data-wi-src="component-3.html" />
<!-- ... -->
<!-- Somewhere below -->
<script src="wm-html-include.js"> </script>
```

*The script* includes all the pages referenced by **data-wi-src** attribute into the comprising HTML page.  
**Note!**: *the script* entirely removes the target element replacing it with referenced content.
So if you need any additional styles for included part you should wrap target with some container.
Example:

```html
<div style="width: 300px; height: 200px; background: silver;">
    <link data-wi-src="component.html" />
</div>
```

### Dynamic links

Use ***wmHtmlInclude()*** function of *the script* interface.

```html
<div id="place-here">
</div>
<!-- ... -->
<script src="wm-html-include.js"> </script>
<script>
    var link = document.createElement ('link');
    link.setAttribute ('data-wi-src', 'new-component.html');
    document.getElementById ('place-here').appendChild (link);

    // now do the thing
    window.wmHtmlInclude();
</script>
```


## How it works and restrictions

plus other useful info [here](http://al-scvorets.github.io/wm-html-include.js/)


## Examples
* [Combine dialog panel with jQuery UI Button, jQuery UI menubar plugin and Bootstrap carousel, each in separate HTML file, into one target page](http://wamer.net/examples/wm-html-include/1/index.html)


## License
[MIT License](http://opensource.org/licenses/MIT)


## Alternatives
* [html-imports-content](https://github.com/adjohnson916/html-imports-content)
* [Matthew-Dove/Inject](https://github.com/Matthew-Dove/Inject)
* [LexmarkWeb/csi.js](https://github.com/LexmarkWeb/csi.js)

