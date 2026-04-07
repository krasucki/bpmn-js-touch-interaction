import InteractionEventsModule from 'diagram-js/lib/features/interaction-events';

import TouchInteraction from './core/TouchInteraction.js';
import TouchFix from './core/TouchFix.js';

import './styles/touch-interaction.css';

export default {
  __depends__: [ InteractionEventsModule ],
  __init__: [ 'touchInteraction', 'touchFix' ],
  touchInteraction: [ 'type', TouchInteraction ],
  touchFix: [ 'type', TouchFix ],
};
