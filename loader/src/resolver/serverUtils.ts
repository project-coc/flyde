import { CodeNode, isCodeNode } from "@flyde/core";
import { existsSync } from "fs";

/**
 * Helper to require a module without caching
 */
const requireNoCache = (modulePath: string) => {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
};

let tsNodeRegistered = false;

export function resolveCodeNodeDependencies(path: string): {
    errors: string[];
    nodes: {
        exportName: string;
        node: CodeNode<any>;
    }[];
} {
    if (!path.endsWith(".js") && !path.endsWith(".ts")) {
        throw new Error(`Path ${path} is not a JS or TS file`);
    }

    if (path.endsWith(".ts") && !tsNodeRegistered) {
        try {
            require("ts-node").register({
                transpileOnly: true,
                compilerOptions: {
                    moduleResolution: "NodeNext",
                    module: "NodeNext",
                }
            });
            tsNodeRegistered = true;
        } catch (e) {
            console.error(`Error registering ts-node for ${path}`, e);
        }
    }

    try {
        // This is a hack to require the file
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        let result = requireNoCache(path);
        if (result.__esModule) {
            result = result.default || result;
        }

        if (isCodeNode(result)) {
            return {
                errors: [],
                nodes: [{ exportName: result.id, node: result }],
            };
        } else if (result) {
            if (typeof result === "object") {
                const entries = Object.entries(result);
                const nodes = entries
                    .filter(([, value]) => isCodeNode(value))
                    .map(([key, value]) => ({ exportName: key, node: value as any }));
                const errors: string[] = [];
                return { errors, nodes };
            }
        }
        return {
            errors: [`No code nodes found in ${path}`],
            nodes: [],
        };
    } catch (e) {
        console.error(`Error resolving code node from ${path}`, e);
        return {
            errors: [`Error resolving code node from ${path}: ${e}`],
            nodes: [],
        };
    }
}

export function isCodeNodePath(path: string): boolean {
    return path.endsWith(".js") || path.endsWith(".ts");
}


export function findTypeScriptSource(jsPath: string): string | null {
    if (!jsPath.includes("/dist/") || !jsPath.endsWith(".js")) {
        return null;
    }

    const potentialTsPath = jsPath
        .replace("/dist/", "/src/")
        .replace(".js", ".ts");

    if (existsSync(potentialTsPath)) {
        return potentialTsPath;
    }
    return null;
}

