import { Matrix4, Vector3, MathUtils } from 'three';

export function interpolateMatrix(table, value, index, target = new Matrix4()) {
  const low=Math.floor(value),high=Math.ceil(value),a=table[low][index],b=table[high][index],t=value-low;
  for(let j=0;j<16;j++)target.elements[j]=a[j]+(b[j]-a[j])*t;
  return target;
}

export function createKinematics(K,P) {
  const base=P.instances.map(()=>new Matrix4()),final=P.instances.map(()=>new Matrix4());
  const mount=new Matrix4().fromArray(K.mod),rotation=new Matrix4(),translation=new Matrix4(),gripMount=new Matrix4();
  const padIndices=['Grip_Pad_Left','Grip_Pad_Right'].map(name=>P.instances.findIndex(p=>p.part===name));
  const a=new Vector3(),b=new Vector3();
  function update({theta,gap,roll,explode=0}) {
    // Floating-point interpolation may otherwise make an endpoint 55 + ε,
    // causing ceil() to request a table entry beyond the supplied range.
    theta=MathUtils.clamp(theta,K.thetas[0],K.thetas.at(-1));
    gap=MathUtils.clamp(gap,K.gaps[0],K.gaps.at(-1));
    const dh=.72*(Math.sin(MathUtils.degToRad(theta))-Math.sin(MathUtils.degToRad(K.theta0)));
    gripMount.makeTranslation(0,dh,0).multiply(mount);
    rotation.makeRotationY(MathUtils.degToRad(roll));
    P.instances.forEach((inst,i)=>{
      if(!inst.gripper)interpolateMatrix(K.lift,theta,i,base[i]);
      else {
        interpolateMatrix(K.gripLocal,gap,i-K.nonGripperCount,base[i]);
        if(!inst.wrist_static)base[i].premultiply(rotation);
        base[i].premultiply(gripMount);
      }
      translation.makeTranslation(...K.explode[i].map(v=>v*explode));
      final[i].multiplyMatrices(translation,base[i]);
    });
    return final;
  }
  function fruitCenter(target=new Vector3()) {
    a.fromArray(K.padsLocal[0]).applyMatrix4(base[padIndices[0]]);
    b.fromArray(K.padsLocal[1]).applyMatrix4(base[padIndices[1]]);
    return target.copy(a).add(b).multiplyScalar(.5);
  }
  return {update,fruitCenter,base,final};
}

export const poseReadouts = ({theta,gap}) => ({height:Math.round(720*Math.sin(MathUtils.degToRad(theta))),phi:MathUtils.radToDeg(Math.asin(gap/140)).toFixed(1)});

export function pickingPose(seconds,K) {
  const low=K.thetas[0],mid=K.default.theta,open=K.gaps.at(-1),closed=K.default.gap;
  const ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*ease(Math.max(0,Math.min(1,t)));
  const pose={theta:low,gap:open,roll:0,explode:0};let stage,attached=false;
  if(seconds<3){pose.theta=mix(low,mid,seconds/3);stage='升降就位';}
  else if(seconds<5){pose.theta=mid;pose.gap=mix(open,closed,(seconds-3)/2);stage='柔顺夹持';}
  else if(seconds<7){pose.theta=mid;pose.gap=closed;pose.roll=mix(0,90,(seconds-5)/2);stage='旋拧分离';attached=true;}
  else if(seconds<10){pose.theta=mix(mid,low,(seconds-7)/3);pose.gap=closed;pose.roll=90;stage='下降回收';attached=true;}
  else if(seconds<12){pose.gap=closed;pose.roll=90;stage='停留';attached=true;}
  else {pose.theta=mix(low,K.default.theta,(seconds-12)/2);pose.gap=closed;pose.roll=mix(90,K.default.roll,(seconds-12)/2);stage='复位';attached=true;}
  return {pose,stage,attached,done:seconds>=14};
}
