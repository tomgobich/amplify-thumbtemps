import Vue from 'vue';
import store from './store';
import Meta from 'vue-meta';
import Router from 'vue-router';
import { sync } from 'vuex-router-sync';
import Home from './views/Home.vue';

Vue.use(Meta);
Vue.use(Router);

const router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/auth/Login.vue'),
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('./views/auth/SignUp.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./views/About.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./views/admin/Index.vue'),
    },
    {
      path: '/admin/thumbnails',
      name: 'adminThumbanils',
      component: () => import('./views/admin/Thumbnails.vue'),
    },
    {
      path: '/admin/thumbnails/create',
      name: 'adminThumbnailsCreate',
      component: () => import('./views/admin/ThumbnailsCreate.vue'),
    },
    {
      path: '/admin/thumbnails/:slug',
      name: 'adminThumbnailsEdit',
      component: () => import('./views/admin/ThumbnailsCreate.vue'),
    },
    {
      path: '/admin/categories',
      name: 'adminCategories',
      component: () => import('./views/admin/Categories.vue'),
    },
    {
      path: '/admin/downloads',
      name: 'adminDownloads',
      component: () => import('./views/admin/Downloads.vue'),
    },
    {
      path: '/admin/images',
      name: 'adminImages',
      component: () => import('./views/admin/Images.vue'),
    },
  ],
});

// The middleware for every page of the application.
// const globalMiddleware = [ 'locale', 'check-auth' ];
const globalMiddleware = [];

// Load middleware modules dynamically.
const routeMiddleware = resolveMiddleware(
  require.context('./middleware', false, /.*\.js$/),
);

sync(store, router);

router.beforeEach(beforeEach);
router.afterEach(afterEach);

/**
 * Global router guard.
 *
 * @param {Route} to
 * @param {Route} from
 * @param {Function} next
 */
async function beforeEach(to, from, next) {
  // Get the matched components and resolve them.
  const components = await resolveComponents(router.getMatchedComponents({ ...to }));

  if (components.length === 0) {
    return next();
  }

  // Start the loading bar.
  if (components[components.length - 1].loading !== false) {
    router.app.$nextTick(() => router.app.$loading.start());
  }

  // Get the middleware for all the matched components.
  const middleware = getMiddleware(components);

  // Call each middleware.
  callMiddleware(middleware, to, from, async (...args) => {
    let comp = components[0].default ? components[0].default : components[0];

    // Set the application layout only if "next()" was called with no args.
    if (args.length === 0) {
      // set layout
      let layout = comp.layout || '';
      router.app.setLayout(layout);
    }

    function _next(data) {
      let compData = {};

      if (typeof data !== 'object' || Array.isArray(data)) {
        data = { data };
      }

      if (typeof comp.data === 'function') {
        compData = comp.data();
      }

      comp.data = () => ({
        ...compData,
        ...data,
      });

      next(...args);
    }

    if (typeof comp.asyncData === 'function') {
      const asyncData = await comp.asyncData({ ...to, from, store });
      _next(asyncData);
    } else {
      next(...args);
    }
  });
}

/**
 * Global after hook.
 *
 * @param {Route} to
 * @param {Route} from
 * @param {Function} next
 */
async function afterEach(to, from, next) {
  await router.app.$nextTick();

  router.app.$loading.finish();
}

/**
 * Call each middleware.
 *
 * @param {Array} middleware
 * @param {Route} to
 * @param {Route} from
 * @param {Function} next
 */
function callMiddleware(middleware, to, from, next) {
  const stack = middleware.reverse();

  const _next = (...args) => {
    // Stop if "_next" was called with an argument or the stack is empty.
    if (args.length > 0 || stack.length === 0) {
      if (args.length > 0) {
        router.app.$loading.finish();
      }

      return next(...args);
    }

    const middleware = stack.pop();

    if (typeof middleware === 'function') {
      middleware(to, from, _next);
    } else if (routeMiddleware[middleware]) {
      routeMiddleware[middleware](to, from, _next);
    } else {
      throw Error(`Undefined middleware [${middleware}]`);
    }
  };

  _next();
}

/**
 * Resolve async components.
 *
 * @param  {Array} components
 * @return {Array}
 */
function resolveComponents(components) {
  return Promise.all(
    components.map(component => {
      return typeof component === 'function' ? component() : component;
    }),
  );
}

/**
 * Merge the the global middleware with the components middleware.
 *
 * @param  {Array} components
 * @return {Array}
 */
function getMiddleware(components) {
  const middleware = [...globalMiddleware];

  components
    .filter(c => (c.middleware ? c.middleware : (c.default || {}).middleware))
    .forEach(component => {
      var mw = component.middleware
        ? component.middleware
        : (component.default || {}).middleware;
      Array.isArray(mw) ? middleware.push(...mw) : middleware.push(mw);
    });

  return middleware;
}

/**
 * Scroll Behavior
 *
 * @link https://router.vuejs.org/en/advanced/scroll-behavior.html
 *
 * @param  {Route} to
 * @param  {Route} from
 * @param  {Object|undefined} savedPosition
 * @return {Object}
 */
function scrollBehavior(to, from, savedPosition) {
  if (savedPosition) {
    return savedPosition;
  }

  if (to.hash) {
    return { selector: to.hash };
  }

  const [component] = router.getMatchedComponents({ ...to }).slice(-1);

  if (component && component.scrollToTop === false) {
    return {};
  }

  return { x: 0, y: 0 };
}

/**
 * @param  {Object} requireContext
 * @return {Object}
 */
function resolveMiddleware(requireContext) {
  return requireContext
    .keys()
    .map(file => [file.replace(/(^.\/)|(\.js$)/g, ''), requireContext(file)])
    .reduce((guards, [name, guard]) => ({ ...guards, [name]: guard.default }), {});
}

export default router;
