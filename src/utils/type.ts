export function hasOwnFunction<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, Function> {
    return obj.hasOwnProperty(prop);
}
