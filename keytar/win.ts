// @deno-lint-ignore 2615
const advapi32 = Deno.dlopen(
    "Advapi32.dll",
    {
        "CredReadW": {
            name: "CredReadW",
            parameters: ["buffer", "i32", "i32", "pointer"],
            result: "bool",
        },
        "CredWriteW": {
            name: "CredWriteW",
            parameters: ["pointer", "u32"],
            result: "bool",
        },
        "CredFree": {
            name: "CredFree",
            parameters: ["pointer"],
            result: "bool",
        },
        "CredDeleteW": {
            name: "CredDeleteW",
            parameters: ["u8", "i32", "u32"],
            result: "bool",
        },
        "CredEnumerateW": {
            name: "CredEnumerateW",
            parameters: ["buffer", "i32", "pointer", "pointer"],
            result: "bool",
        },
    },
);
console.log(advapi32);
