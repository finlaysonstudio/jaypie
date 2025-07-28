import { force } from "jaypie";

interface HandlerConfigOptions {
  locals?: Record<string, any>;
  setup?: Array<() => void | Promise<void>>;
  teardown?: Array<() => void | Promise<void>>;
  validate?: Array<() => boolean | Promise<boolean>>;
}

interface HandlerConfig {
  name: string;
  locals: Record<string, any>;
  setup: Array<() => void | Promise<void>>;
  teardown: Array<() => void | Promise<void>>;
  validate: Array<() => boolean | Promise<boolean>>;
}

const handlerConfig = (
  nameOrConfig: string | (HandlerConfig & { name: string }),
  options: HandlerConfigOptions = {}
): HandlerConfig => {
  let name: string;
  let locals: Record<string, any>;
  let setup: Array<() => void | Promise<void>>;
  let teardown: Array<() => void | Promise<void>>;
  let validate: Array<() => boolean | Promise<boolean>>;

  if (typeof nameOrConfig === "object") {
    ({ name, locals = {}, setup = [], teardown = [], validate = [] } = nameOrConfig);
  } else {
    name = nameOrConfig;
    ({ locals = {}, setup = [], teardown = [], validate = [] } = options);
  }

  return {
    name,
    locals: { ...force.object(locals) },
    setup: [...force.array(setup)],
    teardown: [...force.array(teardown)],
    validate: [...force.array(validate)],
  };
};

export default handlerConfig;