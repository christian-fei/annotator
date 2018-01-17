/* package annotator.ui */
'use strict'

var util = require('../util')

var editor = require('./editor')
var highlighter = require('./highlighter')
var textselector = require('./textselector')
var viewer = require('./viewer')

var _t = util.gettext

// annotationFactory returns a function that can be used to construct an
// annotation from a list of selected ranges.
function annotationFactory (contextEl, ignoreSelector) {
  return function (ranges) {
    var text = []
    var serializedRanges = []

    for (var i = 0, len = ranges.length; i < len; i++) {
      var r = ranges[i]
      text.push(r.text().trim())
      const serializedRange = r.serialize(contextEl, ignoreSelector)
      console.log('serializedRange', serializedRange)
      serializedRanges.push(serializedRange)
    }

    return {
      ranges: serializedRanges
    }
  }
}

// Helper function to remove dynamic stylesheets
function removeDynamicStyle () {
  util.$('#annotator-dynamic-style').remove()
}

/**
 * function:: main([options])
 *
 * A module that provides a default user interface for Annotator that allows
 * users to create annotations by selecting text within (a part of) the
 * document.
 *
 * Example::
 *
 *     app.include(annotator.ui.main);
 *
 * :param Object options:
 *
 *   .. attribute:: options.element
 *
 *      A DOM element to which event listeners are bound. Defaults to
 *      ``document.body``, allowing annotation of the whole document.
 *
 *   .. attribute:: options.editorExtensions
 *
 *      An array of editor extensions. See the
 *      :class:`~annotator.ui.editor.Editor` documentation for details of editor
 *      extensions.
 *
 *   .. attribute:: options.viewerExtensions
 *
 *      An array of viewer extensions. See the
 *      :class:`~annotator.ui.viewer.Viewer` documentation for details of viewer
 *      extensions.
 *
 */
function main (options) {
  if (typeof options === 'undefined' || options === null) {
    options = {}
  }

  options.element = options.element || global.document.body
  options.viewerExtensions = options.viewerExtensions || []

    // Local helpers
  var makeAnnotation = annotationFactory(options.element, '.annotator-hl')

    // Object to hold local state
  var state = {
    interactionPoint: null
  }

  function start (app) {
    var ident = app.registry.getUtility('identityPolicy')
    var authz = app.registry.getUtility('authorizationPolicy')

    state.highlighter = new highlighter.Highlighter(options.element)

    state.textselector = new textselector.TextSelector(options.element, {
      onSelection: function (ranges, event) {
        if (ranges.length > 0) {
          var annotation = makeAnnotation(ranges)
          console.log('new annotation!', annotation)
          state.interactionPoint = util.mousePosition(event)
          app.annotations.create(annotation)
        }
      }
    })

    state.viewer = new viewer.Viewer({
      onEdit: function (ann) {
                // Copy the interaction point from the shown viewer:
        state.interactionPoint = util.$(state.viewer.element)
                                         .css(['top', 'left'])

        app.annotations.update(ann)
      },
      onDelete: function (ann) {
        app.annotations['delete'](ann)
      },
      permitEdit: function (ann) {
        return authz.permits('update', ann, ident.who())
      },
      permitDelete: function (ann) {
        return authz.permits('delete', ann, ident.who())
      },
      autoViewHighlights: options.element,
      extensions: options.viewerExtensions
    })
    state.viewer.attach()
  }

  return {
    start: start,

    destroy: function () {
      state.editor.destroy()
      state.highlighter.destroy()
      state.textselector.destroy()
      state.viewer.destroy()
      removeDynamicStyle()
    },

    annotationsLoaded: function (anns) { state.highlighter.drawAll(anns) },
    annotationCreated: function (ann) { state.highlighter.draw(ann) },
    annotationDeleted: function (ann) { state.highlighter.undraw(ann) },
    annotationUpdated: function (ann) { state.highlighter.redraw(ann) },

    beforeAnnotationCreated: function (annotation) {
            // Editor#load returns a promise that is resolved if editing
            // completes, and rejected if editing is cancelled. We return it
            // here to "stall" the annotation process until the editing is
            // done.
      return Promise.resolve()
      // return state.editor.load(annotation, state.interactionPoint)
    },

    beforeAnnotationUpdated: function (annotation) {
      return Promise.resolve()
      // return state.editor.load(annotation, state.interactionPoint)
    }
  }
}

exports.main = main
